export type NotionFetch = (input: string, init?: RequestInit) => Promise<Response>;

export class NotionApiError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "NotionApiError";
  }
}

export interface NotionApiClientOptions {
  fetchFn?: NotionFetch;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
  minimumIntervalMs?: number;
  maximumRetries?: number;
  requestTimeoutMs?: number;
}

interface NotionErrorBody {
  code?: string;
  message?: string;
}

export interface NotionPageRecord {
  id: string;
  archived?: boolean;
  in_trash?: boolean;
  last_edited_time?: string;
  properties: Record<string, unknown>;
}

export interface NotionDataSourceRecord {
  id: string;
  properties: Record<string, { id?: string; type?: string; [key: string]: unknown }>;
}

export class NotionApiClient {
  private readonly fetchFn: NotionFetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly minimumIntervalMs: number;
  private readonly maximumRetries: number;
  private readonly requestTimeoutMs: number;
  private nextRequestAt = 0;
  private queue: Promise<void> = Promise.resolve();

  public constructor(private readonly token: string, options: NotionApiClientOptions = {}) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.minimumIntervalMs = Math.max(334, options.minimumIntervalMs ?? 350);
    this.maximumRetries = options.maximumRetries ?? 4;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 20_000;
  }

  public request<T>(endpoint: string, method = "GET", body?: unknown): Promise<T> {
    const run = this.queue.then(() => this.execute<T>(endpoint, method, body));
    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }

  private async execute<T>(endpoint: string, method: string, body?: unknown): Promise<T> {
    let attempt = 0;
    while (true) {
      const waitForSlot = Math.max(0, this.nextRequestAt - this.now());
      if (waitForSlot > 0) await this.sleep(waitForSlot);
      this.nextRequestAt = this.now() + this.minimumIntervalMs;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
      let response: Response;
      try {
        response = await this.fetchFn(`https://api.notion.com/v1${endpoint}`, {
          method,
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Notion-Version": "2025-09-03",
            "Content-Type": "application/json",
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (error: unknown) {
        clearTimeout(timeout);
        if (attempt >= this.maximumRetries) {
          const message = error instanceof Error ? error.message : "Network request failed";
          throw new NotionApiError(message, 0, "network_error", true);
        }
        await this.sleep(this.backoff(attempt++));
        continue;
      } finally {
        clearTimeout(timeout);
      }

      if (response.ok) return (await response.json()) as T;

      const errorBody = (await response.json().catch(() => ({}))) as NotionErrorBody;
      const status = response.status;
      const code = errorBody.code ?? `http_${status}`;
      const retryable = status === 429 || status >= 500;
      if (retryable && attempt < this.maximumRetries) {
        const retryAfterSeconds = Number.parseInt(response.headers.get("Retry-After") ?? "", 10);
        const delay = status === 429 && Number.isFinite(retryAfterSeconds)
          ? Math.max(1, retryAfterSeconds) * 1_000
          : this.backoff(attempt);
        attempt++;
        await this.sleep(delay);
        continue;
      }

      throw new NotionApiError(
        errorBody.message ?? `Notion request failed with HTTP ${status}`,
        status,
        code,
        retryable,
      );
    }
  }

  private backoff(attempt: number): number {
    const base = Math.min(8_000, 500 * 2 ** attempt);
    return Math.round(base + base * 0.2 * this.random());
  }

  public async testConnection(): Promise<{ name: string }> {
    const user = await this.request<{ name?: string }>("/users/me");
    return { name: user.name ?? "Hakim Integration" };
  }

  public retrieveDataSource(dataSourceId: string): Promise<NotionDataSourceRecord> {
    return this.request(`/data_sources/${dataSourceId}`);
  }

  public async resolveDataSourceId(databaseOrDataSourceId: string): Promise<string> {
    try {
      const dataSource = await this.retrieveDataSource(databaseOrDataSourceId);
      return dataSource.id;
    } catch (error: unknown) {
      if (!(error instanceof NotionApiError) || error.status !== 404) throw error;
    }
    const database = await this.request<{ data_sources?: Array<{ id: string }> }>(`/databases/${databaseOrDataSourceId}`);
    const dataSourceId = database.data_sources?.[0]?.id;
    if (!dataSourceId) throw new Error("The selected Notion database has no data source");
    return dataSourceId;
  }

  public updateDataSource(dataSourceId: string, properties: Record<string, unknown>): Promise<NotionDataSourceRecord> {
    return this.request(`/data_sources/${dataSourceId}`, "PATCH", { properties });
  }

  public async queryAllPages(
    dataSourceId: string,
    body: Record<string, unknown> = {},
  ): Promise<NotionPageRecord[]> {
    const pages: NotionPageRecord[] = [];
    let cursor: string | undefined;
    do {
      const response = await this.request<{
        results: NotionPageRecord[];
        has_more: boolean;
        next_cursor: string | null;
      }>(`/data_sources/${dataSourceId}/query`, "POST", {
        ...body,
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      });
      pages.push(...response.results);
      cursor = response.has_more && response.next_cursor ? response.next_cursor : undefined;
    } while (cursor);
    return pages;
  }

  public createPage(dataSourceId: string, properties: Record<string, unknown>): Promise<NotionPageRecord> {
    return this.request("/pages", "POST", {
      parent: { type: "data_source_id", data_source_id: dataSourceId },
      properties,
    });
  }

  public updatePage(pageId: string, properties: Record<string, unknown>): Promise<NotionPageRecord> {
    return this.request(`/pages/${pageId}`, "PATCH", { properties });
  }

  public async retrieveAllBlockChildren(blockId: string): Promise<unknown[]> {
    const blocks: unknown[] = [];
    let cursor: string | undefined;
    do {
      const query = new URLSearchParams({ page_size: "100" });
      if (cursor) query.set("start_cursor", cursor);
      const response = await this.request<{
        results: unknown[];
        has_more: boolean;
        next_cursor: string | null;
      }>(`/blocks/${blockId}/children?${query.toString()}`);
      blocks.push(...response.results);
      cursor = response.has_more && response.next_cursor ? response.next_cursor : undefined;
    } while (cursor);
    return blocks;
  }
}
