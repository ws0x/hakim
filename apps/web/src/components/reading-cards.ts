import type { BookItem, HighlightItem } from "../core/types.js";

export class ReadingCardsComponent {
  private container: HTMLElement;
  private currentTab: "highlights" | "books" | "kanban" = "highlights";

  private onSelectHighlight?: (highlight: HighlightItem) => void;
  private onSelectBook?: (bookId: string) => void;
  private onUpdateBookStatus?: (bookId: string, status: "reading" | "completed" | "want_to_read") => void;

  constructor(
    container: HTMLElement,
    callbacks?: {
      onSelectHighlight?: (highlight: HighlightItem) => void;
      onSelectBook?: (bookId: string) => void;
      onUpdateBookStatus?: (bookId: string, status: "reading" | "completed" | "want_to_read") => void;
    }
  ) {
    this.container = container;
    this.onSelectHighlight = callbacks?.onSelectHighlight;
    this.onSelectBook = callbacks?.onSelectBook;
    this.onUpdateBookStatus = callbacks?.onUpdateBookStatus;
  }

  public render(books: BookItem[], highlights: HighlightItem[]): void {
    this.container.innerHTML = "";

    // 1. Sub-navigation Header
    const navHeader = document.createElement("div");
    navHeader.className = "cards-nav-header";

    const subtabsContainer = document.createElement("div");
    subtabsContainer.className = "cards-subtabs";

    const tabDefs: Array<{ id: "highlights" | "books" | "kanban"; label: string }> = [
      { id: "highlights", label: `Highlights Grid (${highlights.length})` },
      { id: "books", label: `Books Shelf (${books.length})` },
      { id: "kanban", label: "Reading OS Kanban" },
    ];

    tabDefs.forEach((tab) => {
      const btn = document.createElement("button");
      btn.className = `subtab-btn ${this.currentTab === tab.id ? "active" : ""}`;
      btn.setAttribute("data-subtab", tab.id);
      btn.textContent = tab.label;
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
    grid.className = "highlights-card-grid";

    if (highlights.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state-card";
      empty.innerHTML = "<p>No highlights match the current filters.</p>";
      grid.appendChild(empty);
      return grid;
    }

    highlights.forEach((hl) => {
      const card = document.createElement("article");
      card.className = `highlight-card color-border-${hl.color}`;

      const colorClass =
        hl.color === "blue" ? "tag-blue" : hl.color === "pink" ? "tag-pink" : hl.color === "orange" ? "tag-orange" : "tag-yellow";
      const colorLabel =
        hl.color === "blue" ? "Quote / Fact" : hl.color === "pink" ? "Critical / Action" : hl.color === "orange" ? "Concept / Story" : "Key Insight";

      card.innerHTML = `
        <div class="card-meta-top">
          <span class="book-title-badge" title="${hl.bookTitle}">📖 ${hl.bookTitle}</span>
          <span class="loc-pill">${hl.location ? `Loc ${hl.location}` : "Note"}</span>
        </div>
        <blockquote class="card-quote-text">“${hl.rawText}”</blockquote>
        ${hl.sourceNote ? `<div class="card-note-box"><strong>✍️ Note:</strong> ${hl.sourceNote}</div>` : ""}
        ${hl.interpretation ? `<div class="card-interp-box"><strong>🧠 Reflection:</strong> ${hl.interpretation}</div>` : ""}
        <div class="card-footer">
          <span class="${colorClass}">${colorLabel}</span>
          ${hl.importance ? `<span class="importance-pill imp-${hl.importance.toLowerCase()}">${hl.importance}</span>` : ""}
        </div>
      `;

      card.addEventListener("click", () => {
        if (this.onSelectHighlight) this.onSelectHighlight(hl);
      });

      grid.appendChild(card);
    });

    return grid;
  }

  private createBooksGrid(books: BookItem[]): HTMLElement {
    const grid = document.createElement("div");
    grid.className = "books-card-grid";

    books.forEach((book) => {
      const card = document.createElement("article");
      card.className = "book-shelf-card";
      card.innerHTML = `
        <div class="book-cover-placeholder">
          <span class="book-cover-emoji">📖</span>
        </div>
        <div class="book-shelf-details">
          <h3 class="book-shelf-title">${book.title}</h3>
          <p class="book-shelf-author">By ${book.author}</p>
          <div class="book-shelf-stats">
            <span>💡 <strong>${book.highlightsCount}</strong> Highlights</span>
            <span class="status-pill status-${book.status || 'reading'}">${book.status || 'reading'}</span>
          </div>
          ${book.tags && book.tags.length > 0 ? `<div class="book-tags-row">${book.tags.map(t => `<span class="book-tag-chip">#${t}</span>`).join(" ")}</div>` : ""}
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
          <h4 class="kanban-item-title">${book.title}</h4>
          <p class="kanban-item-author">${book.author}</p>
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
}
