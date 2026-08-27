import type { HighlightItem } from "../core/types.js";

export interface ReviewStats {
  total: number;
  reviewed: number;
  mastered: number;
  hard: number;
  currentStreak: number;
  bestStreak: number;
}

export class ActiveRecallComponent {
  private container: HTMLElement;
  private deck: HighlightItem[] = [];
  private currentIndex = 0;
  private isFlipped = false;
  private stats: ReviewStats = { total: 0, reviewed: 0, mastered: 0, hard: 0, currentStreak: 0, bestStreak: 0 };

  constructor(container: HTMLElement) {
    this.container = container;
    this.initKeyboardEvents();
  }

  public setDeck(highlights: HighlightItem[]): void {
    this.deck = [...highlights];
    this.currentIndex = 0;
    this.isFlipped = false;
    this.stats = {
      total: this.deck.length,
      reviewed: 0,
      mastered: 0,
      hard: 0,
      currentStreak: 0,
      bestStreak: 0,
    };
    this.render();
  }

  private initKeyboardEvents(): void {
    window.addEventListener("keydown", (e) => {
      // Only handle when container is visible
      if (this.container.style.display === "none") return;

      if (e.code === "Space") {
        e.preventDefault();
        this.flipCard();
      } else if (e.key === "1" || e.key === "ArrowLeft") {
        if (this.isFlipped) this.rateCard("hard");
      } else if (e.key === "2" || e.key === "ArrowDown") {
        if (this.isFlipped) this.rateCard("good");
      } else if (e.key === "3" || e.key === "ArrowRight") {
        if (this.isFlipped) this.rateCard("mastered");
      }
    });
  }

  public flipCard(): void {
    this.isFlipped = !this.isFlipped;
    const cardInner = this.container.querySelector(".flashcard-inner");
    if (cardInner) {
      if (this.isFlipped) {
        cardInner.classList.add("is-flipped");
      } else {
        cardInner.classList.remove("is-flipped");
      }
    }
  }

  public rateCard(rating: "hard" | "good" | "mastered"): void {
    if (rating === "hard") {
      this.stats.hard++;
      this.stats.currentStreak = 0;
      // Put back at the end of deck for re-testing
      if (this.currentIndex < this.deck.length) {
        const current = this.deck[this.currentIndex]!;
        this.deck.push(current);
      }
    } else if (rating === "good") {
      this.stats.currentStreak++;
      this.stats.bestStreak = Math.max(this.stats.bestStreak, this.stats.currentStreak);
    } else if (rating === "mastered") {
      this.stats.mastered++;
      this.stats.currentStreak++;
      this.stats.bestStreak = Math.max(this.stats.bestStreak, this.stats.currentStreak);
    }

    this.stats.reviewed++;
    this.currentIndex++;
    this.isFlipped = false;
    this.render();
  }

  public shuffle(): void {
    for (let i = this.deck.length - 1; i > this.currentIndex; i--) {
      const j = this.currentIndex + Math.floor(Math.random() * (i - this.currentIndex + 1));
      const temp = this.deck[i]!;
      this.deck[i] = this.deck[j]!;
      this.deck[j] = temp;
    }
    this.render();
  }

  public restart(): void {
    this.currentIndex = 0;
    this.isFlipped = false;
    this.stats = {
      total: this.deck.length,
      reviewed: 0,
      mastered: 0,
      hard: 0,
      currentStreak: 0,
      bestStreak: 0,
    };
    this.render();
  }

  public render(): void {
    this.container.innerHTML = "";

    if (this.deck.length === 0) {
      this.container.innerHTML = `
        <div class="empty-flashcards-box">
          <p>No highlights in this library to review. Add or import highlights first!</p>
        </div>
      `;
      return;
    }

    // Check if session complete
    if (this.currentIndex >= this.deck.length) {
      this.renderSummary();
      return;
    }

    const currentCard = this.deck[this.currentIndex]!;
    const progressPercent = Math.round((this.currentIndex / this.deck.length) * 100);

    const stage = document.createElement("div");
    stage.className = "flashcard-stage";

    stage.innerHTML = `
      <!-- Progress Bar & Streak Info -->
      <div class="flashcard-progress-bar-wrapper">
        <div class="flashcard-progress-info">
          <span>Card <strong>${this.currentIndex + 1}</strong> of <strong>${this.deck.length}</strong></span>
          <span class="flashcard-streak-badge">${this.stats.currentStreak > 1 ? `🔥 ${this.stats.currentStreak} Streak` : `${progressPercent}% Complete`}</span>
        </div>
        <div class="flashcard-progress-track">
          <div class="flashcard-progress-fill" style="width: ${progressPercent}%"></div>
        </div>
      </div>

      <!-- 3D Flippable Flashcard -->
      <div class="flashcard-scene">
        <div class="flashcard-inner ${this.isFlipped ? "is-flipped" : ""}">
          <!-- FRONT SIDE -->
          <div class="flashcard-face flashcard-front">
            <div class="flashcard-header">
              <span class="flashcard-book-badge">📖 ${this.escapeHtml(currentCard.bookTitle)}</span>
              <span class="flashcard-hint-badge">💡 Active Recall Prompt</span>
            </div>
            <div class="flashcard-body">
              <p class="flashcard-prompt-label">What is the core insight or cognitive principle behind this quote?</p>
              <blockquote class="flashcard-prompt-quote">“${this.escapeHtml(currentCard.rawText)}”</blockquote>
            </div>
            <div class="flashcard-footer">
              <button id="btn-flip-card-front" class="btn btn-primary">
                <span>Reveal Concept Takeaway (Press Space)</span>
              </button>
            </div>
          </div>

          <!-- BACK SIDE -->
          <div class="flashcard-face flashcard-back">
            <div class="flashcard-header">
              <span class="flashcard-book-badge">📖 ${this.escapeHtml(currentCard.bookTitle)}</span>
              <span class="flashcard-loc-pill">${currentCard.location ? `Loc ${currentCard.location}` : "Note"}</span>
            </div>
            <div class="flashcard-body">
              <div class="flashcard-back-section">
                <h4 class="section-sublabel">Original Highlight</h4>
                <p class="flashcard-back-quote">“${this.escapeHtml(currentCard.rawText)}”</p>
              </div>

              ${currentCard.sourceNote ? `
                <div class="flashcard-back-section">
                  <h4 class="section-sublabel">✍️ Your Note</h4>
                  <p class="flashcard-back-note">${this.escapeHtml(currentCard.sourceNote)}</p>
                </div>
              ` : ""}

              ${currentCard.interpretation ? `
                <div class="flashcard-back-section">
                  <h4 class="section-sublabel">🧠 Hakim Concept Takeaway</h4>
                  <p class="flashcard-back-interp">${this.escapeHtml(currentCard.interpretation)}</p>
                </div>
              ` : ""}
            </div>

            <div class="flashcard-ratings-row">
              <button class="rating-btn rate-hard" data-rate="hard" title="Shortcut: 1 or Left Arrow">
                <span>🔴 Again</span>
              </button>
              <button class="rating-btn rate-good" data-rate="good" title="Shortcut: 2 or Down Arrow">
                <span>🔵 Good</span>
              </button>
              <button class="rating-btn rate-mastered" data-rate="mastered" title="Shortcut: 3 or Right Arrow">
                <span>🟢 Mastered</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Shortcuts Legend -->
      <div class="flashcard-shortcuts-legend">
        <span><kbd>Space</kbd> Flip</span>
        <span><kbd>1</kbd> Again</span>
        <span><kbd>2</kbd> Good</span>
        <span><kbd>3</kbd> Mastered</span>
      </div>
    `;

    // Wire Card Flip
    stage.querySelector("#btn-flip-card-front")?.addEventListener("click", () => this.flipCard());
    stage.querySelector(".flashcard-scene")?.addEventListener("click", (e) => {
      // Don't flip if clicking rating buttons
      if ((e.target as HTMLElement).closest(".rating-btn")) return;
      this.flipCard();
    });

    // Wire Rating Buttons
    stage.querySelectorAll<HTMLButtonElement>(".rating-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const rating = btn.getAttribute("data-rate") as "hard" | "good" | "mastered" | null;
        if (rating) this.rateCard(rating);
      });
    });

    this.container.appendChild(stage);
  }

  private renderSummary(): void {
    const summary = document.createElement("div");
    summary.className = "flashcard-summary-card";

    const masteryPercent = this.stats.total > 0 ? Math.round((this.stats.mastered / this.stats.total) * 100) : 100;

    summary.innerHTML = `
      <div class="summary-celebration-badge">🎉</div>
      <h2 class="summary-title">Active Recall Session Complete!</h2>
      <p class="summary-subtitle">You have reviewed all ${this.stats.total} highlight prompts in this deck.</p>

      <div class="summary-stats-grid">
        <div class="summary-stat-box">
          <span class="summary-stat-num">${this.stats.total}</span>
          <span class="summary-stat-label">Total Prompts</span>
        </div>
        <div class="summary-stat-box">
          <span class="summary-stat-num text-emerald">${this.stats.mastered}</span>
          <span class="summary-stat-label">Mastered</span>
        </div>
        <div class="summary-stat-box">
          <span class="summary-stat-num text-rose">${this.stats.hard}</span>
          <span class="summary-stat-label">Review Again</span>
        </div>
        <div class="summary-stat-box">
          <span class="summary-stat-num text-accent">${masteryPercent}%</span>
          <span class="summary-stat-label">Mastery Rate</span>
        </div>
      </div>

      <div class="summary-actions">
        <button id="btn-restart-deck" class="btn btn-primary">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
          </svg>
          <span>Review Deck Again</span>
        </button>
      </div>
    `;

    summary.querySelector("#btn-restart-deck")?.addEventListener("click", () => this.restart());
    this.container.appendChild(summary);
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}
