import { VaultExporter, type VaultExportResult } from "../core/export/vault-exporter.js";
import { ReadingStateStore } from "../core/store.js";

export class ObsidianExportModal {
  private container: HTMLElement;
  private store: ReadingStateStore;
  private currentResult: VaultExportResult | null = null;
  private selectedFilePath: string = "Index.md";

  constructor() {
    this.store = ReadingStateStore.getInstance();

    this.container = document.createElement("div");
    this.container.className = "obsidian-modal-backdrop";
    this.container.style.display = "none";
    document.body.appendChild(this.container);

    this.initDOM();
  }

  private initDOM(): void {
    this.container.innerHTML = `
      <div class="obsidian-modal-window" role="dialog" aria-labelledby="obsidian-modal-title" aria-modal="true">
        <div class="obsidian-modal-header">
          <div class="obsidian-modal-title-row">
            <span class="obsidian-gem-icon">💎</span>
            <h3 id="obsidian-modal-title" class="obsidian-modal-title">Export Obsidian Markdown Vault</h3>
          </div>
          <button id="btn-close-obsidian-modal" class="btn-modal-close" aria-label="Close modal">&times;</button>
        </div>

        <div class="obsidian-modal-body">
          <div class="obsidian-layout">
            <!-- Left: File Tree Browser -->
            <div class="obsidian-tree-panel">
              <div class="tree-header">Vault Structure</div>
              <div id="obsidian-tree-list" class="obsidian-tree-list"></div>
            </div>

            <!-- Right: Live Markdown Preview -->
            <div class="obsidian-preview-panel">
              <div class="preview-header">
                <span id="preview-file-title" class="preview-filename">Index.md</span>
                <span class="preview-badge">Obsidian Format</span>
              </div>
              <pre id="obsidian-code-view" class="obsidian-code-view"><code></code></pre>
            </div>
          </div>
        </div>

        <div class="obsidian-modal-footer">
          <div class="obsidian-stats-row">
            <span id="vault-stats-text" class="vault-stats-text">0 Books • 0 Highlights</span>
          </div>
          <div class="obsidian-actions-row">
            <button id="btn-copy-vault-file" class="btn btn-secondary">
              <span>Copy File Markdown</span>
            </button>
            <button id="btn-download-vault-zip" class="btn btn-primary">
              <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
              <span>Download Vault (.zip)</span>
            </button>
          </div>
        </div>
      </div>
    `;

    // Close button
    this.container.querySelector("#btn-close-obsidian-modal")?.addEventListener("click", () => this.close());
    this.container.addEventListener("click", (e) => {
      if (e.target === this.container) this.close();
    });

    // Actions
    this.container.querySelector("#btn-download-vault-zip")?.addEventListener("click", () => this.handleDownloadZip());
    this.container.querySelector("#btn-copy-vault-file")?.addEventListener("click", () => this.handleCopyCurrentFile());
  }

  public open(): void {
    this.container.style.display = "flex";
    this.generateAndRender();
  }

  public close(): void {
    this.container.style.display = "none";
  }

  private generateAndRender(): void {
    const state = this.store.getState();
    this.currentResult = VaultExporter.generateVault(state.books, state.highlights);

    // Update stats
    const statsText = this.container.querySelector("#vault-stats-text");
    if (statsText) {
      statsText.textContent = `📦 ${this.currentResult.booksCount} Books • ${this.currentResult.highlightsCount} Highlights • ${this.currentResult.conceptsCount} Concepts`;
    }

    // Render tree list
    const treeList = this.container.querySelector("#obsidian-tree-list");
    if (treeList) {
      treeList.innerHTML = this.currentResult.files.map((file) => `
        <div class="tree-item ${file.path === this.selectedFilePath ? "active" : ""}" data-path="${file.path}">
          <span class="tree-icon">${file.path.startsWith("Books/") ? "📖" : file.path.startsWith("Concepts/") ? "🧠" : "📄"}</span>
          <span class="tree-name">${file.path}</span>
        </div>
      `).join("");

      // Add click listeners to tree items
      treeList.querySelectorAll<HTMLElement>(".tree-item").forEach((item) => {
        item.addEventListener("click", () => {
          const path = item.getAttribute("data-path");
          if (path) {
            this.selectedFilePath = path;
            treeList.querySelectorAll(".tree-item").forEach((i) => i.classList.remove("active"));
            item.classList.add("active");
            this.renderSelectedFilePreview();
          }
        });
      });
    }

    this.renderSelectedFilePreview();
  }

  private renderSelectedFilePreview(): void {
    if (!this.currentResult) return;

    const file = this.currentResult.files.find((f) => f.path === this.selectedFilePath) || this.currentResult.files[0];
    if (!file) return;

    const titleEl = this.container.querySelector("#preview-file-title");
    const codeEl = this.container.querySelector("#obsidian-code-view code");

    if (titleEl) titleEl.textContent = file.path;
    if (codeEl) codeEl.textContent = file.content;
  }

  private handleDownloadZip(): void {
    if (!this.currentResult) return;
    this.currentResult.zipBuilder.downloadZip("hakim-obsidian-vault.zip");
  }

  private handleCopyCurrentFile(): void {
    if (!this.currentResult) return;
    const file = this.currentResult.files.find((f) => f.path === this.selectedFilePath);
    if (file && navigator.clipboard) {
      navigator.clipboard.writeText(file.content);
      const btnSpan = this.container.querySelector("#btn-copy-vault-file span");
      if (btnSpan) {
        btnSpan.textContent = "Copied!";
        setTimeout(() => { btnSpan.textContent = "Copy File Markdown"; }, 2000);
      }
    }
  }
}
