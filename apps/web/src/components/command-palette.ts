import { ReadingStateStore } from "../core/store.js";
import type { BookItem, HighlightItem } from "../core/types.js";

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: "Actions" | "Books" | "Highlights" | "Views";
  icon: string;
  action: () => void;
}

export class CommandPaletteComponent {
  private container: HTMLElement;
  private input: HTMLInputElement;
  private resultsList: HTMLElement;
  private store: ReadingStateStore;

  private items: CommandItem[] = [];
  private filteredItems: CommandItem[] = [];
  private selectedIndex = 0;
  private isOpen = false;

  private onSelectViewCallback?: (view: "graph" | "cards" | "flashcards") => void;
  private onOpenAiCallback?: () => void;
  private onOpenObsidianCallback?: () => void;
  private onOpenEngineCallback?: () => void;

  constructor(callbacks: {
    onSelectView?: (view: "graph" | "cards" | "flashcards") => void;
    onOpenAi?: () => void;
    onOpenObsidian?: () => void;
    onOpenEngine?: () => void;
  }) {
    this.store = ReadingStateStore.getInstance();
    this.onSelectViewCallback = callbacks.onSelectView;
    this.onOpenAiCallback = callbacks.onOpenAi;
    this.onOpenObsidianCallback = callbacks.onOpenObsidian;
    this.onOpenEngineCallback = callbacks.onOpenEngine;

    this.container = document.createElement("div");
    this.container.className = "cmd-palette-backdrop";
    this.container.style.display = "none";
    document.body.appendChild(this.container);

    this.container.innerHTML = `
      <div class="cmd-palette-window" role="dialog" aria-modal="true" aria-label="Command Palette">
        <div class="cmd-input-row">
          <svg class="cmd-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input 
            type="text" 
            class="cmd-input" 
            placeholder="Type a command, book title, or quote keyword..." 
            autocomplete="off" 
            spellcheck="false"
          />
          <span class="cmd-kbd-esc">ESC</span>
        </div>

        <div class="cmd-results-container">
          <div class="cmd-results-list" role="listbox"></div>
        </div>

        <div class="cmd-footer">
          <div class="cmd-hints">
            <span><kbd>↑</kbd><kbd>↓</kbd> to navigate</span>
            <span><kbd>↵</kbd> to select</span>
            <span><kbd>ESC</kbd> to close</span>
          </div>
          <span class="cmd-brand-hint">Hakim Spotlight</span>
        </div>
      </div>
    `;

    this.input = this.container.querySelector(".cmd-input") as HTMLInputElement;
    this.resultsList = this.container.querySelector(".cmd-results-list") as HTMLElement;

    this.initEvents();
  }

  private initEvents(): void {
    // Backdrop click
    this.container.addEventListener("click", (e) => {
      if (e.target === this.container) this.close();
    });

    // Input search
    this.input.addEventListener("input", () => {
      this.filterItems(this.input.value);
    });

    // Keyboard navigation inside input
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredItems.length - 1);
        this.renderResults();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.renderResults();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (this.filteredItems[this.selectedIndex]) {
          this.executeItem(this.filteredItems[this.selectedIndex]!);
        }
      } else if (e.key === "Escape") {
        this.close();
      }
    });

    // Global shortcut ⌘K / Ctrl+K
    window.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  public open(): void {
    this.isOpen = true;
    this.container.style.display = "flex";
    this.buildItems();
    this.input.value = "";
    this.filterItems("");
    setTimeout(() => this.input.focus(), 50);
  }

  public close(): void {
    this.isOpen = false;
    this.container.style.display = "none";
  }

  public toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  private buildItems(): void {
    const state = this.store.getState();
    const items: CommandItem[] = [];

    // 1. Actions & Workspaces
    items.push({
      id: "view-graph",
      title: "Switch to Knowledge Graph View",
      subtitle: "2D Force-directed Obsidian canvas graph",
      category: "Views",
      icon: "🌐",
      action: () => this.onSelectViewCallback?.("graph"),
    });

    items.push({
      id: "view-cards",
      title: "Switch to Reading Cards & Shelf",
      subtitle: "Editorial cards grid and 3-column Kanban",
      category: "Views",
      icon: "📑",
      action: () => this.onSelectViewCallback?.("cards"),
    });

    items.push({
      id: "view-recall",
      title: "Switch to 3D Active Recall Deck",
      subtitle: "Spaced repetition flashcards review",
      category: "Views",
      icon: "🎯",
      action: () => this.onSelectViewCallback?.("flashcards"),
    });

    items.push({
      id: "act-ai",
      title: "Launch AI Reading Intelligence",
      subtitle: "Executive synthesis, concept clusters & questions",
      category: "Actions",
      icon: "✨",
      action: () => this.onOpenAiCallback?.(),
    });

    items.push({
      id: "act-obsidian",
      title: "Export Obsidian Markdown Vault (.zip)",
      subtitle: "Download complete vault with reciprocal wikilinks",
      category: "Actions",
      icon: "💎",
      action: () => this.onOpenObsidianCallback?.(),
    });

    items.push({
      id: "act-engine",
      title: "Connect Local SQLite Engine (127.0.0.1:4242)",
      subtitle: "Sync with local offline daemon and database",
      category: "Actions",
      icon: "⚡",
      action: () => this.onOpenEngineCallback?.(),
    });

    // 2. Books
    for (const b of state.books) {
      items.push({
        id: `book-${b.id}`,
        title: b.title,
        subtitle: `by ${b.author} • ${b.highlightsCount} highlights`,
        category: "Books",
        icon: "📖",
        action: () => {
          this.store.selectBook(b.id);
          this.onSelectViewCallback?.("cards");
        },
      });
    }

    // 3. Highlights
    for (const h of state.highlights.slice(0, 30)) {
      items.push({
        id: `hl-${h.id}`,
        title: h.rawText.length > 80 ? h.rawText.substring(0, 77) + "..." : h.rawText,
        subtitle: `From ${h.bookTitle} (Loc ${h.location || 'N/A'})`,
        category: "Highlights",
        icon: "💬",
        action: () => {
          this.store.selectHighlight(h);
        },
      });
    }

    this.items = items;
  }

  private filterItems(query: string): void {
    const q = query.toLowerCase().trim();
    if (!q) {
      this.filteredItems = this.items;
    } else {
      this.filteredItems = this.items.filter((item) =>
        item.title.toLowerCase().includes(q) || (item.subtitle && item.subtitle.toLowerCase().includes(q))
      );
    }

    this.selectedIndex = 0;
    this.renderResults();
  }

  private renderResults(): void {
    if (this.filteredItems.length === 0) {
      this.resultsList.innerHTML = `<div class="cmd-empty-state">No matching commands, books, or highlights found.</div>`;
      return;
    }

    let html = "";
    let currentCategory = "";

    this.filteredItems.forEach((item, index) => {
      if (item.category !== currentCategory) {
        currentCategory = item.category;
        html += `<div class="cmd-category-header">${currentCategory}</div>`;
      }

      const isSelected = index === this.selectedIndex;
      html += `
        <div class="cmd-item ${isSelected ? "selected" : ""}" data-index="${index}" role="option" aria-selected="${isSelected}">
          <span class="cmd-item-icon">${item.icon}</span>
          <div class="cmd-item-text">
            <span class="cmd-item-title">${this.escapeHtml(item.title)}</span>
            ${item.subtitle ? `<span class="cmd-item-subtitle">${this.escapeHtml(item.subtitle)}</span>` : ""}
          </div>
          ${isSelected ? `<span class="cmd-item-enter">↵</span>` : ""}
        </div>
      `;
    });

    this.resultsList.innerHTML = html;

    // Click handler for result items
    this.resultsList.querySelectorAll<HTMLElement>(".cmd-item").forEach((el) => {
      el.addEventListener("click", () => {
        const idx = Number(el.getAttribute("data-index"));
        if (this.filteredItems[idx]) {
          this.executeItem(this.filteredItems[idx]!);
        }
      });
    });

    // Scroll active item into view
    const activeEl = this.resultsList.querySelector(".cmd-item.selected") as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }

  private executeItem(item: CommandItem): void {
    this.close();
    item.action();
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}
