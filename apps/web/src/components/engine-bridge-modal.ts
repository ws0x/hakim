import { EngineClientAdapter, type EngineHealthResult } from "../core/adapters/engine-adapter.js";
import { ReadingStateStore } from "../core/store.js";

export class EngineBridgeModal {
  private container: HTMLElement;
  private store: ReadingStateStore;
  private statusBtn: HTMLButtonElement | null = null;
  private isConnected = false;

  constructor(statusBtnId: string = "btn-engine-status") {
    this.store = ReadingStateStore.getInstance();
    this.statusBtn = document.getElementById(statusBtnId) as HTMLButtonElement | null;

    this.container = document.createElement("div");
    this.container.className = "engine-modal-backdrop";
    this.container.style.display = "none";
    document.body.appendChild(this.container);

    this.initDOM();
    this.checkInitialConnection();
  }

  private initDOM(): void {
    const savedToken = EngineClientAdapter.getSavedToken();

    this.container.innerHTML = `
      <div class="engine-modal-window" role="dialog" aria-labelledby="engine-modal-title" aria-modal="true">
        <div class="engine-modal-header">
          <div class="engine-modal-title-row">
            <span class="engine-icon">⚡</span>
            <h3 id="engine-modal-title" class="engine-modal-title">Hakim Local Engine Bridge</h3>
          </div>
          <button id="btn-close-engine-modal" class="btn-modal-close" aria-label="Close modal">&times;</button>
        </div>

        <div class="engine-modal-body">
          <p class="engine-modal-desc">
            Connect directly to your local SQLite database (<code>127.0.0.1:4242</code>) for instant offline reading intelligence, automated background imports, and AI insights.
          </p>

          <!-- Live Status Box -->
          <div id="engine-status-box" class="engine-status-box">
            <div class="status-indicator-dot dot-gray"></div>
            <div class="status-text-block">
              <span id="engine-status-text" class="status-headline">Checking local engine daemon...</span>
              <span id="engine-substatus-text" class="status-subline">http://127.0.0.1:4242</span>
            </div>
          </div>

          <!-- Pairing Token Field -->
          <div class="engine-field-group">
            <label for="engine-token-input" class="engine-field-label">Pairing Token (Bearer Auth)</label>
            <input 
              type="password" 
              id="engine-token-input" 
              class="engine-input" 
              placeholder="Paste token from: hakim token"
              value="${savedToken}"
            />
            <p class="engine-field-hint">Run <code>hakim token</code> or <code>hakim start</code> in your terminal to view or generate your pairing secret.</p>
          </div>

          <!-- Feedback message -->
          <div id="engine-feedback-msg" class="engine-feedback-msg" style="display: none;"></div>

          <!-- Actions -->
          <div class="engine-modal-actions">
            <button id="btn-connect-engine" class="btn btn-primary btn-full">
              <span>Connect & Load SQLite Library</span>
            </button>
          </div>
        </div>
      </div>
    `;

    // Close button
    this.container.querySelector("#btn-close-engine-modal")?.addEventListener("click", () => this.close());
    this.container.addEventListener("click", (e) => {
      if (e.target === this.container) this.close();
    });

    // Status button in header opens modal
    if (this.statusBtn) {
      this.statusBtn.addEventListener("click", () => this.open());
    }

    // Connect action
    this.container.querySelector("#btn-connect-engine")?.addEventListener("click", () => this.handleConnect());
  }

  public open(): void {
    this.container.style.display = "flex";
    this.checkHealth();
  }

  public close(): void {
    this.container.style.display = "none";
  }

  public async checkInitialConnection(): Promise<void> {
    const health = await EngineClientAdapter.checkHealth();
    this.updateHealthUI(health);

    const token = EngineClientAdapter.getSavedToken();
    if (health.healthy && token) {
      // Auto-load if token was already saved
      const res = await EngineClientAdapter.fetchLibrary(token);
      if (res.books.length > 0) {
        this.store.loadCustomData(res.books, res.highlights, "custom_file");
        this.isConnected = true;
        this.updateHeaderBadge(true, `Engine: ${res.books.length} Books`);
      }
    }
  }

  public async checkHealth(): Promise<EngineHealthResult> {
    const health = await EngineClientAdapter.checkHealth();
    this.updateHealthUI(health);
    return health;
  }

  private updateHealthUI(health: EngineHealthResult): void {
    const statusBox = this.container.querySelector("#engine-status-box");
    const statusDot = this.container.querySelector(".status-indicator-dot");
    const statusText = this.container.querySelector("#engine-status-text");
    const subText = this.container.querySelector("#engine-substatus-text");

    if (health.healthy) {
      if (statusDot) {
        statusDot.className = "status-indicator-dot dot-emerald";
      }
      if (statusText) {
        statusText.textContent = `● Engine Online (v${health.version || "1.0.0"})`;
      }
      if (subText) {
        subText.textContent = `SQLite Store: ${health.booksCount || 0} books, ${health.annotCount || 0} highlights available`;
      }
      this.updateHeaderBadge(true, "● Engine Online");
    } else {
      if (statusDot) {
        statusDot.className = "status-indicator-dot dot-gray";
      }
      if (statusText) {
        statusText.textContent = "○ Engine Offline or Not Running";
      }
      if (subText) {
        subText.textContent = "Start with: pnpm --filter @hakim/engine start";
      }
      this.updateHeaderBadge(false, "○ Engine Offline");
    }
  }

  private updateHeaderBadge(online: boolean, label: string): void {
    if (this.statusBtn) {
      this.statusBtn.className = `btn-engine-status ${online ? "online" : "offline"}`;
      const textSpan = this.statusBtn.querySelector(".engine-status-label");
      if (textSpan) textSpan.textContent = label;
    }
  }

  private async handleConnect(): Promise<void> {
    const tokenInput = this.container.querySelector<HTMLInputElement>("#engine-token-input");
    const token = tokenInput?.value.trim() || "";
    const feedback = this.container.querySelector<HTMLElement>("#engine-feedback-msg");
    const btn = this.container.querySelector<HTMLButtonElement>("#btn-connect-engine");

    if (!token) {
      if (feedback) {
        feedback.style.display = "block";
        feedback.className = "engine-feedback-msg error";
        feedback.textContent = "Please enter a pairing token.";
      }
      return;
    }

    if (btn) btn.disabled = true;
    if (feedback) {
      feedback.style.display = "block";
      feedback.className = "engine-feedback-msg info";
      feedback.textContent = "Verifying pairing and fetching SQLite library...";
    }

    const pairResult = await EngineClientAdapter.verifyPairing(token);
    if (!pairResult.success) {
      if (feedback) {
        feedback.className = "engine-feedback-msg error";
        feedback.textContent = pairResult.error || "Authentication failed. Check your token.";
      }
      if (btn) btn.disabled = false;
      return;
    }

    // Save token
    EngineClientAdapter.saveToken(token);

    // Fetch full library
    const lib = await EngineClientAdapter.fetchLibrary(token);
    if (lib.error) {
      if (feedback) {
        feedback.className = "engine-feedback-msg error";
        feedback.textContent = lib.error;
      }
      if (btn) btn.disabled = false;
      return;
    }

    // Hydrate store
    this.store.loadCustomData(lib.books, lib.highlights, "custom_file");
    this.isConnected = true;
    this.updateHeaderBadge(true, `Engine: ${lib.books.length} Books`);

    if (feedback) {
      feedback.className = "engine-feedback-msg success";
      feedback.textContent = `✓ Connected! Successfully loaded ${lib.books.length} books and ${lib.highlights.length} highlights.`;
    }

    if (btn) btn.disabled = false;

    setTimeout(() => {
      this.close();
    }, 1200);
  }
}
