import { ReadingStateStore, type ReadingState } from "../core/store.js";
import { FileImportAdapter } from "../core/adapters/file-adapter.js";
import { CanvasGraphEngine } from "./graph-canvas.js";
import { ReadingCardsComponent } from "./reading-cards.js";
import { SlideoverDrawer } from "./slideover-drawer.js";
import { ActiveRecallComponent } from "./active-recall.js";
import { EngineBridgeModal } from "./engine-bridge-modal.js";
import { AISynthesisModal } from "./ai-synthesis-modal.js";
import { ObsidianExportModal } from "./obsidian-export-modal.js";
import { CommandPaletteComponent } from "./command-palette.js";
import type { AnnotationColor, GraphNode } from "../core/types.js";

export class WorkspaceController {
  private store: ReadingStateStore;
  private graphEngine: CanvasGraphEngine | null = null;
  private cardsComponent: ReadingCardsComponent | null = null;
  private flashcardsComponent: ActiveRecallComponent | null = null;
  private slideover: SlideoverDrawer | null = null;
  private engineBridge: EngineBridgeModal | null = null;
  private aiModal: AISynthesisModal | null = null;
  private obsidianModal: ObsidianExportModal | null = null;
  private commandPalette: CommandPaletteComponent | null = null;

  constructor() {
    this.store = ReadingStateStore.getInstance();
    this.init();
  }

  private init(): void {
    // 1. Initialize Graph Canvas Engine inside #graph-container
    const graphContainer = document.getElementById("graph-container");
    if (graphContainer) {
      this.graphEngine = new CanvasGraphEngine(graphContainer, (node: GraphNode) => {
        this.handleNodeClick(node);
      });
    }

    // 2. Initialize Reading Cards Component inside #cards-container
    const cardsContainer = document.getElementById("cards-container");
    if (cardsContainer) {
      this.cardsComponent = new ReadingCardsComponent(cardsContainer, {
        onSelectHighlight: (hl) => this.store.selectHighlight(hl),
        onSelectBook: (bookId) => this.store.selectBook(bookId),
        onUpdateBookStatus: (bookId, status) => this.store.updateBookStatus(bookId, status),
      });
    }

    // 3. Initialize Active Recall Flashcards Component inside #flashcards-container
    const flashcardsContainer = document.getElementById("flashcards-container");
    if (flashcardsContainer) {
      this.flashcardsComponent = new ActiveRecallComponent(flashcardsContainer);
    }

    // 4. Initialize Slideover Detail Drawer
    this.slideover = new SlideoverDrawer();

    // 5. Initialize Local SQLite Engine Bridge Modal
    this.engineBridge = new EngineBridgeModal("btn-engine-status");

    // 6. Initialize AI Synthesis Modal
    this.aiModal = new AISynthesisModal();
    const btnAi = document.getElementById("btn-ai-synthesis");
    if (btnAi) {
      btnAi.addEventListener("click", () => this.aiModal?.open());
    }

    // 7. Initialize Obsidian Export Modal
    this.obsidianModal = new ObsidianExportModal();
    const btnObsidian = document.getElementById("btn-obsidian-export");
    if (btnObsidian) {
      btnObsidian.addEventListener("click", () => this.obsidianModal?.open());
    }

    // 8. Initialize Spotlight Command Palette (⌘K)
    this.commandPalette = new CommandPaletteComponent({
      onSelectView: (view) => this.store.setView(view),
      onOpenAi: () => this.aiModal?.open(),
      onOpenObsidian: () => this.obsidianModal?.open(),
      onOpenEngine: () => this.engineBridge?.open(),
    });

    const btnSpotlight = document.getElementById("btn-spotlight-trigger");
    if (btnSpotlight) {
      btnSpotlight.addEventListener("click", () => this.commandPalette?.open());
    }

    // 9. Subscribe to Store State Changes
    this.store.subscribe((state) => this.render(state));

    // 6. Setup Search Input Listener
    const searchInput = document.getElementById("search-input") as HTMLInputElement | null;
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        this.store.setSearchQuery(searchInput.value);
      });
    }

    // 7. Setup Dataset Selector
    const datasetSelect = document.getElementById("dataset-select") as HTMLSelectElement | null;
    if (datasetSelect) {
      datasetSelect.addEventListener("change", () => {
        if (datasetSelect.value === "demo") {
          this.store.loadDemoData();
        }
      });
    }

    // 8. Setup View Switcher Buttons
    const viewButtons = document.querySelectorAll<HTMLButtonElement>(".view-btn");
    viewButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.getAttribute("data-view") as "graph" | "cards" | "flashcards" | null;
        if (view) {
          this.store.setView(view);
        }
      });
    });

    // 9. Setup Color Dot Filters
    const colorDots = document.querySelectorAll<HTMLButtonElement>(".color-dot-btn");
    colorDots.forEach((btn) => {
      btn.addEventListener("click", () => {
        const color = btn.getAttribute("data-color") as AnnotationColor | null;
        if (color) {
          this.store.toggleColorFilter(color);
        }
      });
    });

    // 10. Setup Canvas Control Buttons (Zoom, Reset, Physics)
    const btnZoomIn = document.getElementById("btn-graph-zoom-in");
    const btnZoomOut = document.getElementById("btn-graph-zoom-out");
    const btnResetView = document.getElementById("btn-graph-reset");
    const btnTogglePhysics = document.getElementById("btn-graph-physics");

    if (btnZoomIn) btnZoomIn.addEventListener("click", () => this.graphEngine?.zoomIn());
    if (btnZoomOut) btnZoomOut.addEventListener("click", () => this.graphEngine?.zoomOut());
    if (btnResetView) btnResetView.addEventListener("click", () => this.graphEngine?.resetView());
    if (btnTogglePhysics) {
      btnTogglePhysics.addEventListener("click", () => {
        const isRunning = this.graphEngine?.togglePhysics();
        btnTogglePhysics.classList.toggle("active", isRunning);
      });
    }

    // 11. Setup File Upload Button
    const fileInput = document.getElementById("file-upload-input") as HTMLInputElement | null;
    const btnUpload = document.getElementById("btn-upload-file");
    if (btnUpload && fileInput) {
      btnUpload.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files?.[0];
        if (!file) return;

        const text = await file.text();
        if (file.name.endsWith(".json")) {
          const parsed = FileImportAdapter.parseJsonSnapshot(text);
          this.store.loadCustomData(parsed.books, parsed.highlights, "custom_file");
        } else {
          const parsed = FileImportAdapter.parseMyClippings(text);
          this.store.loadCustomData(parsed.books, parsed.highlights, "custom_file");
        }
      });
    }
  }

  private handleNodeClick(node: GraphNode): void {
    if (node.type === "book") {
      this.store.selectBook(node.id === this.store.getState().filters.selectedBookId ? null : node.id);
    } else if (node.type === "highlight") {
      const match = this.store.getState().highlights.find((h) => h.id === node.id);
      if (match) {
        this.store.selectHighlight(match);
      }
    }
  }

  private render(state: ReadingState): void {
    const graphContainer = document.getElementById("graph-container");
    const cardsContainer = document.getElementById("cards-container");
    const flashcardsContainer = document.getElementById("flashcards-container");
    const graphToolbar = document.querySelector<HTMLElement>(".graph-toolbar");

    // 1. Trigger Slideover if highlight is selected
    if (state.selectedHighlight && this.slideover) {
      this.slideover.open(state.selectedHighlight);
    }

    // 2. Toggle View Containers
    if (state.activeView === "graph") {
      if (graphContainer) graphContainer.style.display = "block";
      if (cardsContainer) cardsContainer.style.display = "none";
      if (flashcardsContainer) flashcardsContainer.style.display = "none";
      if (graphToolbar) graphToolbar.style.display = "flex";

      if (this.graphEngine) {
        this.graphEngine.setData(state.graphData);
      }
    } else if (state.activeView === "cards") {
      if (graphContainer) graphContainer.style.display = "none";
      if (cardsContainer) cardsContainer.style.display = "block";
      if (flashcardsContainer) flashcardsContainer.style.display = "none";
      if (graphToolbar) graphToolbar.style.display = "none";

      if (this.cardsComponent) {
        const filteredHighlights = this.store.getFilteredHighlights();
        this.cardsComponent.render(state.books, filteredHighlights);
      }
    } else if (state.activeView === "flashcards") {
      if (graphContainer) graphContainer.style.display = "none";
      if (cardsContainer) cardsContainer.style.display = "none";
      if (flashcardsContainer) flashcardsContainer.style.display = "flex";
      if (graphToolbar) graphToolbar.style.display = "none";

      if (this.flashcardsComponent) {
        const filteredHighlights = this.store.getFilteredHighlights();
        this.flashcardsComponent.setDeck(filteredHighlights);
      }
    }

    // 3. Render Book List in Sidebar
    const bookListContainer = document.getElementById("sidebar-book-list");
    if (bookListContainer) {
      bookListContainer.innerHTML = "";

      // "All Books" item
      const allItem = document.createElement("button");
      allItem.className = `book-item-btn ${state.filters.selectedBookId === null ? "active" : ""}`;
      allItem.innerHTML = `<span>All Library Highlights</span> <span class="book-count-badge">${state.highlights.length}</span>`;
      allItem.addEventListener("click", () => this.store.selectBook(null));
      bookListContainer.appendChild(allItem);

      // Individual Books
      state.books.forEach((book) => {
        const item = document.createElement("button");
        item.className = `book-item-btn ${state.filters.selectedBookId === book.id ? "active" : ""}`;
        item.innerHTML = `<span>📖 ${book.title}</span> <span class="book-count-badge">${book.highlightsCount}</span>`;
        item.addEventListener("click", () => this.store.selectBook(book.id));
        bookListContainer.appendChild(item);
      });
    }

    // 4. Render Active View Buttons
    const viewButtons = document.querySelectorAll<HTMLButtonElement>(".view-btn");
    viewButtons.forEach((btn) => {
      const view = btn.getAttribute("data-view");
      if (view === state.activeView) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    // 5. Render Color Dot Status
    const colorDots = document.querySelectorAll<HTMLButtonElement>(".color-dot-btn");
    colorDots.forEach((btn) => {
      const color = btn.getAttribute("data-color") as AnnotationColor | null;
      if (color && state.filters.selectedColors.has(color)) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    // 6. Update HUD Counters
    const hudNodes = document.getElementById("hud-nodes-count");
    const hudLinks = document.getElementById("hud-links-count");
    const hudFiltered = document.getElementById("hud-filtered-count");

    if (hudNodes) hudNodes.textContent = String(state.graphData.nodes.length);
    if (hudLinks) hudLinks.textContent = String(state.graphData.links.length);
    if (hudFiltered) hudFiltered.textContent = String(this.store.getFilteredHighlights().length);
  }
}
