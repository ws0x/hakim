import type { HighlightItem } from "../core/types.js";

export type CardTheme = "obsidian" | "sunset" | "emerald" | "minimal";
export type AspectRatio = "1:1" | "9:16" | "16:9";

export class QuoteCardModal {
  private container: HTMLElement;
  private currentHighlight: HighlightItem | null = null;
  private currentTheme: CardTheme = "obsidian";
  private currentRatio: AspectRatio = "1:1";

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.container = document.createElement("div");
    this.container.className = "quote-modal-backdrop";
    this.container.style.display = "none";
    document.body.appendChild(this.container);

    this.canvas = document.createElement("canvas");
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("Could not get 2D context for quote card.");
    this.ctx = context;

    this.initDOM();
  }

  private initDOM(): void {
    this.container.innerHTML = `
      <div class="quote-modal-window" role="dialog" aria-labelledby="quote-modal-title" aria-modal="true">
        <div class="quote-modal-header">
          <h3 id="quote-modal-title" class="quote-modal-title">✨ Aesthetic Quote Card Generator</h3>
          <button id="btn-close-quote-modal" class="btn-modal-close" aria-label="Close modal">&times;</button>
        </div>

        <div class="quote-modal-body">
          <!-- Canvas Preview -->
          <div class="quote-canvas-preview-wrapper">
            <div id="quote-canvas-mount" class="quote-canvas-mount"></div>
          </div>

          <!-- Controls Sidebar -->
          <div class="quote-modal-controls">
            <div class="control-group">
              <label class="control-label">Card Theme Gradient</label>
              <div class="theme-options-grid">
                <button class="theme-btn theme-obsidian active" data-theme="obsidian">Obsidian</button>
                <button class="theme-btn theme-sunset" data-theme="sunset">Sunset</button>
                <button class="theme-btn theme-emerald" data-theme="emerald">Emerald</button>
                <button class="theme-btn theme-minimal" data-theme="minimal">Minimal</button>
              </div>
            </div>

            <div class="control-group">
              <label class="control-label">Aspect Ratio</label>
              <div class="ratio-options-grid">
                <button class="ratio-btn active" data-ratio="1:1">1:1 (Square)</button>
                <button class="ratio-btn" data-ratio="9:16">9:16 (Story)</button>
                <button class="ratio-btn" data-ratio="16:9">16:9 (Banner)</button>
              </div>
            </div>

            <div class="modal-actions-footer">
              <button id="btn-download-card-png" class="btn btn-primary btn-full">
                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                </svg>
                <span>Download High-Res PNG</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const canvasMount = this.container.querySelector("#quote-canvas-mount");
    if (canvasMount) {
      canvasMount.appendChild(this.canvas);
    }

    // Close button & click outside
    this.container.querySelector("#btn-close-quote-modal")?.addEventListener("click", () => this.close());
    this.container.addEventListener("click", (e) => {
      if (e.target === this.container) this.close();
    });

    // Theme selector buttons
    this.container.querySelectorAll<HTMLButtonElement>(".theme-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const theme = btn.getAttribute("data-theme") as CardTheme | null;
        if (theme) {
          this.currentTheme = theme;
          this.container.querySelectorAll(".theme-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          this.renderCanvas();
        }
      });
    });

    // Ratio selector buttons
    this.container.querySelectorAll<HTMLButtonElement>(".ratio-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ratio = btn.getAttribute("data-ratio") as AspectRatio | null;
        if (ratio) {
          this.currentRatio = ratio;
          this.container.querySelectorAll(".ratio-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          this.renderCanvas();
        }
      });
    });

    // Download action
    this.container.querySelector("#btn-download-card-png")?.addEventListener("click", () => this.downloadPNG());
  }

  public open(highlight: HighlightItem): void {
    this.currentHighlight = highlight;
    this.container.style.display = "flex";
    this.renderCanvas();
  }

  public close(): void {
    this.container.style.display = "none";
  }

  public renderCanvas(): void {
    if (!this.currentHighlight) return;

    let width = 1200;
    let height = 1200;

    if (this.currentRatio === "9:16") {
      width = 1080;
      height = 1920;
    } else if (this.currentRatio === "16:9") {
      width = 1920;
      height = 1080;
    }

    this.canvas.width = width;
    this.canvas.height = height;

    // 1. Render Background Theme Gradient
    if (this.currentTheme === "obsidian") {
      const grad = this.ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#090a0f");
      grad.addColorStop(0.5, "#151828");
      grad.addColorStop(1, "#090a0f");
      this.ctx.fillStyle = grad;
    } else if (this.currentTheme === "sunset") {
      const grad = this.ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#1f0d14");
      grad.addColorStop(0.5, "#3b1122");
      grad.addColorStop(1, "#18080f");
      this.ctx.fillStyle = grad;
    } else if (this.currentTheme === "emerald") {
      const grad = this.ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#061512");
      grad.addColorStop(0.5, "#0b2923");
      grad.addColorStop(1, "#051310");
      this.ctx.fillStyle = grad;
    } else {
      this.ctx.fillStyle = "#0a0a0d";
    }

    this.ctx.fillRect(0, 0, width, height);

    // 2. Draw Decorative Glowing Borders & Accent Bars
    const accentColor =
      this.currentTheme === "sunset"
        ? "#f43f5e"
        : this.currentTheme === "emerald"
        ? "#10b981"
        : this.currentTheme === "minimal"
        ? "#64748b"
        : "#818cf8";

    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(40, 40, width - 80, height - 80);

    // 3. Top Header Badge: Hakim Brand & Book Title
    this.ctx.font = "bold 26px -apple-system, Inter, sans-serif";
    this.ctx.fillStyle = accentColor;
    this.ctx.fillText("HAKIM READING INTELLIGENCE", 80, 110);

    this.ctx.font = "600 32px -apple-system, Inter, sans-serif";
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    this.ctx.fillText(`📖 ${this.currentHighlight.bookTitle}`, 80, 160);

    // 4. Large Quote Glyph
    this.ctx.font = "bold 140px Georgia, serif";
    this.ctx.fillStyle = accentColor;
    this.ctx.globalAlpha = 0.35;
    this.ctx.fillText("“", 75, 300);
    this.ctx.globalAlpha = 1.0;

    // 5. Quote Body Text with Word Wrapping
    const maxTextWidth = width - 180;
    const fontSize = width > 1200 ? 46 : 40;
    const lineHeight = fontSize * 1.55;
    this.ctx.font = `italic 500 ${fontSize}px Georgia, serif`;
    this.ctx.fillStyle = "#ffffff";

    const words = this.currentHighlight.rawText.split(" ");
    let line = "";
    let currentY = 360;

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + " ";
      const metrics = this.ctx.measureText(testLine);
      if (metrics.width > maxTextWidth && i > 0) {
        this.ctx.fillText(line.trim(), 90, currentY);
        line = words[i] + " ";
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    this.ctx.fillText(line.trim(), 90, currentY);

    // 6. User Note (if present)
    if (this.currentHighlight.sourceNote) {
      currentY += 60;
      this.ctx.font = "bold 28px -apple-system, Inter, sans-serif";
      this.ctx.fillStyle = accentColor;
      this.ctx.fillText("✍️ Personal Reflection:", 90, currentY);

      currentY += 40;
      this.ctx.font = "italic 26px -apple-system, Inter, sans-serif";
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      this.ctx.fillText(`"${this.currentHighlight.sourceNote}"`, 90, currentY);
    }

    // 7. Footer Metadata (Location pill, importance)
    const footerY = height - 100;
    this.ctx.font = "500 24px -apple-system, Inter, sans-serif";
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    const locText = this.currentHighlight.location ? `Location ${this.currentHighlight.location}` : "Personal Note";
    this.ctx.fillText(locText, 90, footerY);

    this.ctx.textAlign = "right";
    this.ctx.fillText("hakim.app", width - 90, footerY);
    this.ctx.textAlign = "left";
  }

  public downloadPNG(): void {
    const dataUrl = this.canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `hakim-quote-${this.currentHighlight?.bookTitle.toLowerCase().replace(/\s+/g, "-") || "card"}.png`;
    link.href = dataUrl;
    link.click();
  }
}
