import type { ImportEnvelope } from "@hakim/domain";

export interface EngineConfig {
  engineUrl: string;
  pairingToken: string;
  amazonDomain: string;
}

export class EngineClient {
  private config: EngineConfig;

  constructor(config: EngineConfig) {
    this.config = config;
  }

  public async checkHealth(): Promise<{ online: boolean; version?: string; library?: { books: number; annotations: number } }> {
    try {
      const res = await fetch(`${this.config.engineUrl}/api/v1/health`, {
        method: "GET",
      });
      if (res.ok) {
        const data = (await res.json()) as { version: string; library: { books: number; annotations: number } };
        return { online: true, version: data.version, library: data.library };
      }
      return { online: false };
    } catch {
      return { online: false };
    }
  }

  public async verifyPairing(): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.engineUrl}/api/v1/pair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: this.config.pairingToken }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async sendEnvelope(envelope: ImportEnvelope): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${this.config.engineUrl}/api/v1/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.pairingToken}`,
        },
        body: JSON.stringify(envelope),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        return { success: false, error: err.error || `HTTP ${res.status}` };
      }

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Connection failed" };
    }
  }
}
