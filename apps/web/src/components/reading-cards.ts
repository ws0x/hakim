import type { BookItem, HighlightItem } from "../core/types.js";

export class ReadingCardsComponent {
  private container: HTMLElement;
  private currentTab: "highlights" | "books" | "kanban" = "highlights";

  private onSelectHighlight?: (highlight: HighlightItem) => void;
  private onSelectBook?: (bookId: string) => void;
  private onUpdateBookStatus?: (bookId: string, status: "reading" | "completed" | "want_to_read") => void;
  private onOpenQuoteCard?: (highlight: HighlightItem) => void;

  constructor(
    container: HTMLElement,
    callbacks?: {
      onSelectHighlight?: (highlight: HighlightItem) => void;
      onSelectBook?: (bookId: string) => void;
      onUpdateBookStatus?: (bookId: string, status: "reading" | "completed" | "want_to_read") => void;
      onOpenQuoteCard?: (highlight: HighlightItem) => void;
    }
  ) {
    this.container = container;
    this.onSelectHighlight = callbacks?.onSelectHighlight;
    this.onSelectBook = callbacks?.onSelectBook;
    this.onUpdateBookStatus = callbacks?.onUpdateBookStatus;
    this.onOpenQuoteCard = callbacks?.onOpenQuoteCard;
  }

  public render(books: BookItem[], highlights: HighlightItem[]): void {
    this.container.innerHTML = "";

    // 1. Sub-navigation Header Bar
    const navHeader = document.createElement("div");
    navHeader.className = "cards-nav-header";

    const subtabsContainer = document.createElement("div");
    subtabsContainer.className = "cards-subtabs";

    const tabDefs: Array<{ id: "highlights" | "books" | "kanban"; label: string; icon: string }> = [
      { id: "highlights", label: `Highlights (${highlights.length})`, icon: "💬" },
      { id: "books", label: `Book Shelf (${books.length})`, icon: "📚" },
      { id: "kanban", label: "Reading OS Kanban", icon: "📊" },
    ];

    tabDefs.forEach((tab) => {
      const btn = document.createElement("button");
      btn.className = `subtab-btn ${this.currentTab === tab.id ? "active" : ""}`;
      btn.setAttribute("data-subtab", tab.id);
      btn.innerHTML = `<span>${tab.icon}</span> <span>${tab.label}</span>`;
      btn.addEventListener("click", () => {
        this.currentTab = tab.id;
        this.render(books, highlights);
      });
      subtabsContainer.appendChild(btn);
    });

    navHeader.appendChild(subtabsContainer);
    this.container.appendChild(navHeader);

    // 2. Content Body
    const contentBody = document.createElement("div");
    contentBody.className = "cards-content-body";

    if (this.currentTab === "highlights") {
      contentBody.appendChild(this.createHighlightsGrid(highlights));
    } else if (this.currentTab === "books") {
      contentBody.appendChild(this.createBooksGrid(books));
    } else if (this.currentTab === "kanban") {
      contentBody.appendChild(this.createKanbanBoard(books));
    }

    this.container.appendChild(contentBody);
  }

  private createHighlightsGrid(highlights: HighlightItem[]): HTMLElement {
    const grid = document.createElement("div");
    grid.className = "highlights-masonry-grid";

    if (highlights.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state-editorial";
      empty.innerHTML = `
        <div class="empty-icon-ring">🔍</div>
        <h3>No Highlights Found</h3>
        <p>No annotations match your active search filters or selected book.</p>
      `;
      grid.appendChild(empty);
      return grid;
    }

    highlights.forEach((hl) => {
      const card = document.createElement("article");
      card.className = `editorial-highlight-card color-rail-${hl.color}`;

      const colorLabel =
        hl.color === "blue" ? "Quote / Fact" : hl.color === "pink" ? "Critical / Action" : hl.color === "orange" ? "Thematic / Story" : "Key Insight";

      card.innerHTML = `
        <div class="card-meta-row">
          <span class="card-book-badge" title="${this.escapeHtml(hl.bookTitle)}">📖 ${this.escapeHtml(hl.bookTitle)}</span>
          <span class="card-loc-pill">${hl.location ? `Loc ${hl.location}` : "Note"}</span>
        </div>

        <blockquote class="editorial-quote">“${this.escapeHtml(hl.rawText)}”</blockquote>

        ${hl.sourceNote ? `<div class="editorial-note-box"><strong>✍️ Note:</strong> ${this.escapeHtml(hl.sourceNote)}</div>` : ""}
        ${hl.interpretation ? `<div class="editorial-reflection-box"><strong>🧠 Reflection:</strong> ${this.escapeHtml(hl.interpretation)}</div>` : ""}

        <div class="editorial-card-footer">
          <div class="card-tag-group">
            <span class="card-tag-pill tag-${hl.color}">${colorLabel}</span>
            ${hl.importance ? `<span class="importance-badge imp-${hl.importance.toLowerCase()}">${hl.importance}</span>` : ""}
          </div>

          <div class="card-quick-actions">
            <button class="btn-card-action btn-copy-quote" title="Copy Quote Markdown" aria-label="Copy Quote">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button class="btn-card-action btn-artboard-quote" title="Open Social Quote Studio" aria-label="Social Quote Artboard">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </button>
          </div>
        </div>
      `;

      // Copy Quote Markdown
      const btnCopy = card.querySelector(".btn-copy-quote") as HTMLButtonElement | null;
      btnCopy?.addEventListener("click", (e) => {
        e.stopPropagation();
        const mdText = `> "${hl.rawText}"\n> — **${hl.bookTitle}** (Loc ${hl.location || 'N/A'})`;
        navigator.clipboard?.writeText(mdText);
        btnCopy.innerHTML = `<span style="color:#10b981;font-size:11px;font-weight:700;">✓</span>`;
        setTimeout(() => {
          btnCopy.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
        }, 1500);
      });

      // Social Quote Artboard
      const btnArtboard = card.querySelector(".btn-artboard-quote") as HTMLButtonElement | null;
      btnArtboard?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.onOpenQuoteCard) {
          this.onOpenQuoteCard(hl);
        } else if (this.onSelectHighlight) {
          this.onSelectHighlight(hl);
        }
      });

      // Card Click -> Open Detail Drawer
      card.addEventListener("click", () => {
        if (this.onSelectHighlight) this.onSelectHighlight(hl);
      });

      grid.appendChild(card);
    });

    return grid;
  }

  private createBooksGrid(books: BookItem[]): HTMLElement {
    const grid = document.createElement("div");
    grid.className = "books-shelf-grid";

    books.forEach((book) => {
      const card = document.createElement("article");
      card.className = "book-shelf-card";
      card.innerHTML = `
        <div class="book-cover-placeholder">
          <span class="book-cover-emoji">📖</span>
        </div>
        <div class="book-shelf-details">
          <h3 class="book-shelf-title">${this.escapeHtml(book.title)}</h3>
          <p class="book-shelf-author">By ${this.escapeHtml(book.author)}</p>
          <div class="book-shelf-stats">
            <span>💡 <strong>${book.highlightsCount}</strong> Highlights</span>
            <span class="status-pill status-${book.status || 'reading'}">${book.status || 'reading'}</span>
          </div>
          ${book.tags && book.tags.length > 0 ? `<div class="book-tags-row">${book.tags.map(t => `<span class="book-tag-chip">#${this.escapeHtml(t)}</span>`).join(" ")}</div>` : ""}
        </div>
      `;

      card.addEventListener("click", () => {
        if (this.onSelectBook) this.onSelectBook(book.id);
      });

      grid.appendChild(card);
    });

    return grid;
  }

  private createKanbanBoard(books: BookItem[]): HTMLElement {
    const kanban = document.createElement("div");
    kanban.className = "kanban-board-container";

    const columns: Array<{ id: "reading" | "completed" | "want_to_read"; title: string; emoji: string }> = [
      { id: "reading", title: "Currently Reading", emoji: "📖" },
      { id: "completed", title: "Completed & Processed", emoji: "✅" },
      { id: "want_to_read", title: "Want to Read", emoji: "🔖" },
    ];

    columns.forEach((col) => {
      const colBooks = books.filter((b) => (b.status || "reading") === col.id);
      const colEl = document.createElement("div");
      colEl.className = "kanban-column";

      const header = document.createElement("div");
      header.className = "kanban-col-header";
      header.innerHTML = `
        <span class="kanban-col-title">${col.emoji} ${col.title}</span>
        <span class="kanban-col-count">${colBooks.length}</span>
      `;
      colEl.appendChild(header);

      const stack = document.createElement("div");
      stack.className = "kanban-cards-stack";
      stack.setAttribute("data-status", col.id);

      colBooks.forEach((book) => {
        const item = document.createElement("div");
        item.className = "kanban-book-item";
        item.innerHTML = `
          <h4 class="kanban-item-title">${this.escapeHtml(book.title)}</h4>
          <p class="kanban-item-author">${this.escapeHtml(book.author)}</p>
          <div class="kanban-item-meta">
            <span>💡 ${book.highlightsCount} notes</span>
            <select class="kanban-status-select" aria-label="Change status">
              <option value="reading" ${book.status === "reading" ? "selected" : ""}>Reading</option>
              <option value="completed" ${book.status === "completed" ? "selected" : ""}>Completed</option>
              <option value="want_to_read" ${book.status === "want_to_read" ? "selected" : ""}>Want to Read</option>
            </select>
          </div>
        `;

        const select = item.querySelector<HTMLSelectElement>(".kanban-status-select");
        if (select) {
          select.addEventListener("click", (e) => e.stopPropagation());
          select.addEventListener("change", () => {
            const nextStatus = select.value as "reading" | "completed" | "want_to_read";
            if (this.onUpdateBookStatus) {
              this.onUpdateBookStatus(book.id, nextStatus);
            }
          });
        }

        item.addEventListener("click", () => {
          if (this.onSelectBook) this.onSelectBook(book.id);
        });

        stack.appendChild(item);
      });

      colEl.appendChild(stack);
      kanban.appendChild(colEl);
    });

    return kanban;
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}
