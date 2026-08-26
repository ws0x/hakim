import type { HighlightItem } from "../core/types.js";
import { QuoteCardModal } from "./quote-card-modal.js";
import { ReadingStateStore } from "../core/store.js";

export class SlideoverDrawer {
  private backdrop: HTMLElement;
  private panel: HTMLElement;
  private currentHighlight: HighlightItem | null = null;
  private quoteModal: QuoteCardModal;
  private store: ReadingStateStore;

  constructor() {
    this.store = ReadingStateStore.getInstance();
    this.quoteModal = new QuoteCardModal();

    this.backdrop = document.createElement("div");
    this.backdrop.className = "slideover-backdrop";
    this.backdrop.style.display = "none";

    this.panel = document.createElement("aside");
    this.panel.className = "slideover-panel";
    this.backdrop.appendChild(this.panel);

    document.body.appendChild(this.backdrop);

    this.initEvents();
  }

  private initEvents(): void {
    this.backdrop.addEventListener("click", (e) => {
      if (e.target === this.backdrop) this.close();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.backdrop.style.display !== "none") {
        this.close();
      }
    });
  }

  public open(highlight: HighlightItem): void {
    this.currentHighlight = highlight;
    this.render();
    this.backdrop.style.display = "flex";
    setTimeout(() => this.panel.classList.add("open"), 10);
  }

  public close(): void {
    this.panel.classList.remove("open");
    setTimeout(() => {
      this.backdrop.style.display = "none";
    }, 220);
  }

  private render(): void {
    if (!this.currentHighlight) return;
    const hl = this.currentHighlight;

    const colorLabel =
      hl.color === "blue" ? "Quote / Fact" : hl.color === "pink" ? "Critical / Action" : hl.color === "orange" ? "Concept / Story" : "Key Insight";

    this.panel.innerHTML = `
      <div class="slideover-header">
        <div class="slideover-title-row">
          <span class="slideover-book-badge" title="${this.escapeHtml(hl.bookTitle)}">📖 ${this.escapeHtml(hl.bookTitle)}</span>
          <button id="btn-close-slideover" class="btn-drawer-close" aria-label="Close drawer">&times;</button>
        </div>
        <div class="slideover-meta-row">
          <span class="loc-tag">${hl.location ? `Loc ${hl.location}` : "Note"}</span>
          <span class="color-tag color-${hl.color}">${colorLabel}</span>
          ${hl.importance ? `<span class="importance-tag imp-${hl.importance.toLowerCase()}">${hl.importance} Priority</span>` : ""}
        </div>
      </div>

      <div class="slideover-body">
        <!-- Quote Inspection Box -->
        <div class="quote-inspection-card">
          <blockquote class="inspection-quote-text">“${this.escapeHtml(hl.rawText)}”</blockquote>
        </div>

        <!-- Academic & Markdown Citations -->
        <div class="inspection-section">
          <div class="citation-header-row">
            <h4 class="section-label">📜 Citations & Obsidian Wikilinks</h4>
            <div class="citation-format-picker">
              <button class="btn-cite-format active" data-fmt="obsidian">Obsidian</button>
              <button class="btn-cite-format" data-fmt="apa">APA 7</button>
              <button class="btn-cite-format" data-fmt="mla">MLA 9</button>
              <button class="btn-cite-format" data-fmt="chicago">Chicago</button>
            </div>
          </div>
          <div class="citation-preview-box">
            <code id="citation-text-content">${this.generateCitation(hl, "obsidian")}</code>
            <button id="btn-copy-active-citation" class="btn-copy-citation" title="Copy Citation">Copy</button>
          </div>
        </div>

        <!-- Kindle Note -->
        ${hl.sourceNote ? `
          <div class="inspection-section">
            <h4 class="section-label">✍️ Kindle Note</h4>
            <div class="note-box">${this.escapeHtml(hl.sourceNote)}</div>
          </div>
        ` : ""}

        <!-- Live Reflection Editor -->
        <div class="inspection-section">
          <div class="section-header-row">
            <h4 class="section-label">🧠 Personal Reflection & Mental Model</h4>
            <span id="save-status-indicator" class="save-status">Saved</span>
          </div>
          <textarea id="drawer-reflection-input" class="drawer-reflection-editor" placeholder="Write your thoughts, synthesized insights, or practical applications...">${hl.interpretation || ""}</textarea>
        </div>

        <!-- Topics & Concept Chips -->
        ${hl.tags && hl.tags.length > 0 ? `
          <div class="inspection-section">
            <h4 class="section-label">🏷️ Topics & Concepts</h4>
            <div class="tags-cluster">
              ${hl.tags.map(t => `<span class="topic-chip">#${this.escapeHtml(t)}</span>`).join(" ")}
            </div>
          </div>
        ` : ""}
      </div>

      <div class="slideover-footer">
        <button id="btn-open-quote-card" class="btn btn-primary btn-full">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
          </svg>
          <span>Open Social Quote Studio</span>
        </button>
      </div>
    `;

    // 1. Close Button
    this.panel.querySelector("#btn-close-slideover")?.addEventListener("click", () => this.close());

    // 2. Quote Card Studio
    this.panel.querySelector("#btn-open-quote-card")?.addEventListener("click", () => {
      if (this.currentHighlight) {
        this.quoteModal.open(this.currentHighlight);
      }
    });

    // 3. Citation Format Selector
    let activeFormat = "obsidian";
    const citationCode = this.panel.querySelector("#citation-text-content") as HTMLElement | null;
    const formatButtons = this.panel.querySelectorAll<HTMLButtonElement>(".btn-cite-format");

    formatButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        formatButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        activeFormat = btn.getAttribute("data-fmt") || "obsidian";
        if (citationCode) {
          citationCode.textContent = this.generateCitation(hl, activeFormat);
        }
      });
    });

    // 4. Copy Citation Button
    const btnCopyCite = this.panel.querySelector("#btn-copy-active-citation") as HTMLButtonElement | null;
    btnCopyCite?.addEventListener("click", async () => {
      const text = citationCode?.textContent || "";
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        if (btnCopyCite) {
          btnCopyCite.textContent = "Copied!";
          btnCopyCite.style.color = "#10b981";
          setTimeout(() => {
            btnCopyCite.textContent = "Copy";
            btnCopyCite.style.color = "";
          }, 1800);
        }
      }
    });

    // 5. Reflection Live Editor
    const reflectionTextarea = this.panel.querySelector("#drawer-reflection-input") as HTMLTextAreaElement | null;
    const saveIndicator = this.panel.querySelector("#save-status-indicator") as HTMLElement | null;

    let saveTimeout: any = null;
    reflectionTextarea?.addEventListener("input", () => {
      if (saveIndicator) saveIndicator.textContent = "Saving...";
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        if (this.currentHighlight) {
          this.currentHighlight.interpretation = reflectionTextarea.value;
          this.store.updateHighlightInterpretation(this.currentHighlight.id, reflectionTextarea.value);
          if (saveIndicator) saveIndicator.textContent = "Saved";
        }
      }, 500);
    });
  }

  private generateCitation(hl: HighlightItem, format: string): string {
    const locStr = hl.location ? `Loc ${hl.location}` : "Personal Note";
    switch (format) {
      case "obsidian":
        return `> "${hl.rawText}"\n> — [[Books/${hl.bookTitle}#^hl-${hl.id}]]`;
      case "apa":
        return `"${hl.rawText}" (${hl.bookTitle}, ${locStr}).`;
      case "mla":
        return `"${hl.rawText}." *${hl.bookTitle}*, Kindle ed., ${locStr}.`;
      case "chicago":
        return `"${hl.rawText}," *${hl.bookTitle}* (Kindle ed.), ${locStr}.`;
      default:
        return `> "${hl.rawText}"\n> — **${hl.bookTitle}** (${locStr})`;
    }
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}
