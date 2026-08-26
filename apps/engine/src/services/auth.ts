import { randomBytes, createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export class AuthService {
  private db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
    this.ensurePairingToken();
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  public ensurePairingToken(): string {
    const existing = this.db.prepare("SELECT value FROM engine_config WHERE key = 'pairing_token_hash'").get() as
      | { value: string }
      | undefined;

    if (!existing) {
      const token = randomBytes(24).toString("hex");
      const hash = this.hashToken(token);
      this.db.prepare("INSERT INTO engine_config (key, value) VALUES ('pairing_token_hash', ?)").run(hash);
      return token;
    }

    return "[ALREADY_PROVISIONED]";
  }

  public rotatePairingToken(): string {
    const token = randomBytes(24).toString("hex");
    const hash = this.hashToken(token);
    this.db.prepare("INSERT OR REPLACE INTO engine_config (key, value) VALUES ('pairing_token_hash', ?)").run(hash);
    return token;
  }

  public validateToken(token: string): boolean {
    if (!token) return false;
    const existing = this.db.prepare("SELECT value FROM engine_config WHERE key = 'pairing_token_hash'").get() as
      | { value: string }
      | undefined;

    if (!existing) return false;
    const providedHash = this.hashToken(token.trim());
    return providedHash === existing.value;
  }
}
