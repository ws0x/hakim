import type { BookItem, HighlightItem } from "../types.js";

export interface EngineHealthResult {
  healthy: boolean;
  version?: string;
  booksCount?: number;
  annotCount?: number;
  error?: string;
}

export class EngineClientAdapter {
  private static defaultBaseUrl = "http://127.0.0.1:4242";
  private static storageKey = "hakim_engine_token";

  public static getSavedToken(): string {
    try {
      return localStorage.getItem(EngineClientAdapter.storageKey) || "";
    } catch {
      return "";
    }
  }

  public static saveToken(token: string): void {
    try {
      localStorage.setItem(EngineClientAdapter.storageKey, token.trim());
    } catch {
      // Ignore localStorage errors
    }
  }

  public static clearToken(): void {
    try {
      localStorage.removeItem(EngineClientAdapter.storageKey);
    } catch {
      // Ignore
    }
  }

  public static async checkHealth(baseUrl: string = EngineClientAdapter.defaultBaseUrl): Promise<EngineHealthResult> {
    try {
      const res = await fetch(`${baseUrl}/api/v1/health`, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });

      if (!res.ok) {
        return { healthy: false, error: `Engine responded with HTTP ${res.status}` };
      }

      const data = (await res.json()) as {
        status: string;
        version: string;
        library?: { books: number; annotations: number };
      };

      return {
        healthy: data.status === "healthy",
        version: data.version,
        booksCount: data.library?.books,
        annotCount: data.library?.annotations,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not connect to local engine";
      return { healthy: false, error: msg };
    }
  }

  public static async verifyPairing(
    token: string,
    baseUrl: string = EngineClientAdapter.defaultBaseUrl
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${baseUrl}/api/v1/pair`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({ token: token.trim() }),
      });

      if (!res.ok) {
        return { success: false, error: "Invalid pairing token." };
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error connecting to engine";
      return { success: false, error: msg };
    }
  }

  public static async fetchLibrary(
    token: string,
    baseUrl: string = EngineClientAdapter.defaultBaseUrl
  ): Promise<{ books: BookItem[]; highlights: HighlightItem[]; error?: string }> {
    try {
      const res = await fetch(`${baseUrl}/api/v1/library`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token.trim()}`,
          "Accept": "application/json",
        },
      });

      if (!res.ok) {
        return { books: [], highlights: [], error: `Engine error: HTTP ${res.status}` };
      }

      const data = (await res.json()) as {
        books: BookItem[];
        highlights: HighlightItem[];
      };

      return {
        books: data.books || [],
        highlights: data.highlights || [],
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch library from engine";
      return { books: [], highlights: [], error: msg };
    }
  }
}
