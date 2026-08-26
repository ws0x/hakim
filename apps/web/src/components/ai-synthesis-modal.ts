import { AISynthesisEngine, type ConceptCluster, type ExecutiveSynthesis, type SocraticQuestion } from "../core/ai/ai-engine.js";
import { ReadingStateStore } from "../core/store.js";

export class AISynthesisModal {
  private container: HTMLElement;
  private store: ReadingStateStore;
  private activeTask: "clusters" | "synthesis" | "questions" = "synthesis";

  constructor() {
    this.store = ReadingStateStore.getInstance();

    this.container = document.createElement("div");
    this.container.className = "ai-modal-backdrop";
    this.container.style.display = "none";
    document.body.appendChild(this.container);

    this.initDOM();
  }

  private initDOM(): void {
    this.container.innerHTML = `
      <div class="ai-modal-window" role="dialog" aria-labelledby="ai-modal-title" aria-modal="true">
        <div class="ai-modal-header">
          <div class="ai-modal-title-row">
            <span class="ai-spark-icon">✨</span>
            <h3 id="ai-modal-title" class="ai-modal-title">Hakim AI Reading Intelligence</h3>
          </div>
          <button id="btn-close-ai-modal" class="btn-modal-close" aria-label="Close modal">&times;</button>
        </div>

        <!-- Task Selector Tabs -->
        <div class="ai-tasks-nav">
          <button class="ai-task-btn ${this.activeTask === "synthesis" ? "active" : ""}" data-task="synthesis">
            📝 Executive Synthesis
          </button>
          <button class="ai-task-btn ${this.activeTask === "clusters" ? "active" : ""}" data-task="clusters">
            🧠 Concept Clusters
          </button>
          <button class="ai-task-btn ${this.activeTask === "questions" ? "active" : ""}" data-task="questions">
            🎯 Socratic Questions
          </button>
        </div>

        <div class="ai-modal-body">
          <div id="ai-results-stage" class="ai-results-stage">
            <div class="ai-loading-state">
              <span class="ai-spinner"></span>
              <p>Analyzing reading library highlights...</p>
            </div>
          </div>
        </div>

        <div class="ai-modal-footer">
          <button id="btn-copy-ai-result" class="btn btn-secondary">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            <span>Copy Markdown Synthesis</span>
          </button>
          <button id="btn-re-synthesize" class="btn btn-primary">
            <span>Re-Generate with AI</span>
          </button>
        </div>
      </div>
    `;

    // Close button
    this.container.querySelector("#btn-close-ai-modal")?.addEventListener("click", () => this.close());
    this.container.addEventListener("click", (e) => {
      if (e.target === this.container) this.close();
    });

    // Task Switcher
    this.container.querySelectorAll<HTMLButtonElement>(".ai-task-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const task = btn.getAttribute("data-task") as "clusters" | "synthesis" | "questions" | null;
        if (task) {
          this.activeTask = task;
          this.container.querySelectorAll(".ai-task-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          this.runActiveTask();
        }
      });
    });

    // Actions
    this.container.querySelector("#btn-re-synthesize")?.addEventListener("click", () => this.runActiveTask());
    this.container.querySelector("#btn-copy-ai-result")?.addEventListener("click", () => this.copyMarkdown());
  }

  public open(): void {
    this.container.style.display = "flex";
    this.runActiveTask();
  }

  public close(): void {
    this.container.style.display = "none";
  }

  public async runActiveTask(): Promise<void> {
    const stage = this.container.querySelector<HTMLElement>("#ai-results-stage");
    if (!stage) return;

    stage.innerHTML = `
      <div class="ai-loading-state">
        <span class="ai-spinner"></span>
        <p>Synthesizing insights and cognitive models...</p>
      </div>
    `;

    const highlights = this.store.getFilteredHighlights();
    const books = this.store.getState().books;

    if (this.activeTask === "synthesis") {
      const synthesis = await AISynthesisEngine.generateExecutiveSynthesis(highlights);
      this.renderSynthesis(stage, synthesis);
    } else if (this.activeTask === "clusters") {
      const clusters = await AISynthesisEngine.extractConceptClusters(highlights, books);
      this.renderClusters(stage, clusters);
    } else if (this.activeTask === "questions") {
      const questions = await AISynthesisEngine.generateSocraticQuestions(highlights);
      this.renderQuestions(stage, questions);
    }
  }

  private renderSynthesis(container: HTMLElement, data: ExecutiveSynthesis): void {
    container.innerHTML = `
      <div class="synthesis-result-card">
        <h3 class="synthesis-title">${data.title}</h3>
        <p class="synthesis-summary">${data.summary}</p>

        <div class="synthesis-section">
          <h4 class="synthesis-section-title">🧠 Core Mental Models</h4>
          <ul class="synthesis-list">
            ${data.mentalModels.map((m) => `<li>${m}</li>`).join("")}
          </ul>
        </div>

        <div class="synthesis-section">
          <h4 class="synthesis-section-title">⚡ Actionable Principles</h4>
          <ul class="synthesis-list">
            ${data.actionableTakeaways.map((a) => `<li>${a}</li>`).join("")}
          </ul>
        </div>
      </div>
    `;
  }

  private renderClusters(container: HTMLElement, clusters: ConceptCluster[]): void {
    if (clusters.length === 0) {
      container.innerHTML = `<p class="empty-state-text">No multi-book conceptual clusters found in the active filter.</p>`;
      return;
    }

    container.innerHTML = `
      <div class="clusters-grid">
        ${clusters.map((c) => `
          <div class="cluster-card">
            <div class="cluster-header">
              <span class="cluster-title">${c.conceptName}</span>
              <span class="cluster-count">${c.highlightIds.length} Highlights</span>
            </div>
            <p class="cluster-desc">${c.description}</p>
            <div class="cluster-books-row">
              ${c.relatedBooks.map((b) => `<span class="cluster-book-chip">📖 ${b}</span>`).join(" ")}
            </div>
            <blockquote class="cluster-quote">“${c.keyQuotes[0]?.slice(0, 140) || ''}...”</blockquote>
          </div>
        `).join("")}
      </div>
    `;
  }

  private renderQuestions(container: HTMLElement, questions: SocraticQuestion[]): void {
    if (questions.length === 0) {
      container.innerHTML = `<p class="empty-state-text">No questions generated. Add more highlights to your library.</p>`;
      return;
    }

    container.innerHTML = `
      <div class="questions-list">
        ${questions.map((q, i) => `
          <div class="question-item">
            <div class="question-header">
              <span class="question-badge">Prompt #${i + 1}</span>
              <span class="question-book">📖 ${q.bookTitle}</span>
            </div>
            <h4 class="question-text">${q.question}</h4>
            <div class="question-ideal-box">
              <strong>💡 Ideal Answer / Principle:</strong> ${q.idealAnswer}
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  private copyMarkdown(): void {
    const stage = this.container.querySelector<HTMLElement>("#ai-results-stage");
    const text = stage?.innerText || "";
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      const btnSpan = this.container.querySelector("#btn-copy-ai-result span");
      if (btnSpan) {
        btnSpan.textContent = "Copied to Clipboard!";
        setTimeout(() => { btnSpan.textContent = "Copy Markdown Synthesis"; }, 2000);
      }
    }
  }
}
