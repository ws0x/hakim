import type { HighlightItem } from "../core/types.js";
import { QuoteCardModal } from "./quote-card-modal.js";

export class SlideoverDrawer {
  private backdrop: HTMLElement;
  private panel: HTMLElement;
  private currentHighlight: HighlightItem | null = null;
  private quoteModal: QuoteCardModal;

  constructor() {
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
      if (e.key === "Escape") this.close();
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
    }, 200);
  }

  private render(): void {
    if (!this.currentHighlight) return;
    const hl = this.currentHighlight;

    const colorLabel =
      hl.color === "blue" ? "Quote / Fact" : hl.color === "pink" ? "Critical / Action" : hl.color === "orange" ? "Concept / Story" : "Key Insight";

    this.panel.innerHTML = `
      <div class="slideover-header">
        <div class="slideover-title-row">
          <span class="slideover-book-badge">📖 ${hl.bookTitle}</span>
          <button id="btn-close-slideover" class="btn-drawer-close" aria-label="Close drawer">&times;</button>
        </div>
        <div class="slideover-meta-row">
          <span class="loc-tag">${hl.location ? `Location ${hl.location}` : "Personal Note"}</span>
          <span class="color-tag color-${hl.color}">${colorLabel}</span>
          ${hl.importance ? `<span class="importance-tag imp-${hl.importance.toLowerCase()}">${hl.importance} Priority</span>` : ""}
        </div>
      </div>

      <div class="slideover-body">
        <div class="quote-inspection-card">
          <blockquote class="inspection-quote-text">“${hl.rawText}”</blockquote>
        </div>

        ${hl.sourceNote ? `
          <div class="inspection-section">
            <h4 class="section-label">✍️ Kindle Note</h4>
            <div class="note-box">${hl.sourceNote}</div>
          </div>
        ` : ""}

        ${hl.interpretation ? `
          <div class="inspection-section">
            <h4 class="section-label">🧠 Personal Interpretation</h4>
            <div class="interp-box">${hl.interpretation}</div>
          </div>
        ` : ""}

        ${hl.tags && hl.tags.length > 0 ? `
          <div class="inspection-section">
            <h4 class="section-label">🏷️ Topics & Concepts</h4>
            <div class="tags-cluster">
              ${hl.tags.map(t => `<span class="topic-chip">#${t}</span>`).join(" ")}
            </div>
          </div>
        ` : ""}
      </div>

      <div class="slideover-footer">
        <button id="btn-open-quote-card" class="btn btn-primary btn-full">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
          </svg>
          <span>Generate Aesthetic Quote Card</span>
        </button>

        <button id="btn-copy-quote-md" class="btn btn-secondary btn-full">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <span>Copy Quote & Citation</span>
        </button>
      </div>
    `;

    // Wire actions
    this.panel.querySelector("#btn-close-slideover")?.addEventListener("click", () => this.close());
    
    this.panel.querySelector("#btn-open-quote-card")?.addEventListener("click", () => {
      if (this.currentHighlight) {
        this.quoteModal.open(this.currentHighlight);
      }
    });

    this.panel.querySelector("#btn-copy-quote-md")?.addEventListener("click", async () => {
      const btn = this.panel.querySelector("#btn-copy-quote-md span");
      const citation = `> "${hl.rawText}"\n\n— **${hl.bookTitle}** (Location ${hl.location || 0})`;
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(citation);
        if (btn) {
          btn.textContent = "Copied to Clipboard!";
          setTimeout(() => { btn.textContent = "Copy Quote & Citation"; }, 2500);
        }
      }
    });
  }
}
