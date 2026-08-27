import type { HighlightItem } from "../core/types.js";

export type CardTheme = "obsidian" | "sunset" | "emerald" | "minimal";
export type AspectRatio = "1:1" | "9:16" | "16:9" | "4:5";
export type FontStyle = "serif" | "sans";
export type TextAlign = "left" | "center" | "right";

export class QuoteCardModal {
  private container: HTMLElement;
  private currentHighlight: HighlightItem | null = null;

  // Customizer State
  private currentTheme: CardTheme = "obsidian";
  private currentRatio: AspectRatio = "1:1";
  private fontStyle: FontStyle = "serif";
  private textAlign: TextAlign = "left";
  private fontSize: number = 44;

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
          <div class="quote-modal-title-row">
            <span class="quote-modal-icon">✨</span>
            <h3 id="quote-modal-title" class="quote-modal-title">Social Quote Artboard Studio</h3>
          </div>
          <button id="btn-close-quote-modal" class="btn-modal-close" aria-label="Close modal">&times;</button>
        </div>

        <div class="quote-modal-body">
          <!-- Canvas Live Artboard Preview -->
          <div class="quote-canvas-preview-wrapper">
            <div id="quote-canvas-mount" class="quote-canvas-mount"></div>
          </div>

          <!-- Studio Customization Controls -->
          <div class="quote-modal-controls">
            <!-- 1. Theme Presets -->
            <div class="control-group">
              <label class="control-label">Theme Presets</label>
              <div class="theme-options-grid">
                <button class="theme-btn theme-obsidian active" data-theme="obsidian">Obsidian</button>
                <button class="theme-btn theme-sunset" data-theme="sunset">Sunset Gold</button>
                <button class="theme-btn theme-emerald" data-theme="emerald">Emerald</button>
                <button class="theme-btn theme-minimal" data-theme="minimal">Minimal Slate</button>
              </div>
            </div>

            <!-- 2. Aspect Ratio -->
            <div class="control-group">
              <label class="control-label">Aspect Ratio</label>
              <div class="ratio-options-grid">
                <button class="ratio-btn active" data-ratio="1:1">1:1 Square</button>
                <button class="ratio-btn" data-ratio="4:5">4:5 Portrait</button>
                <button class="ratio-btn" data-ratio="9:16">9:16 Story</button>
                <button class="ratio-btn" data-ratio="16:9">16:9 Banner</button>
              </div>
            </div>

            <!-- 3. Typography & Styling -->
            <div class="control-group">
              <label class="control-label">Typography & Alignment</label>
              <div class="typo-options-row">
                <div class="typo-btn-group">
                  <button id="btn-font-serif" class="typo-toggle-btn active" data-font="serif">Serif</button>
                  <button id="btn-font-sans" class="typo-toggle-btn" data-font="sans">Sans</button>
                </div>
                <div class="typo-btn-group">
                  <button class="align-btn active" data-align="left">Left</button>
                  <button class="align-btn" data-align="center">Center</button>
                  <button class="align-btn" data-align="right">Right</button>
                </div>
              </div>
            </div>

            <!-- 4. Font Size Slider -->
            <div class="control-group">
              <div class="slider-label-row">
                <label class="control-label">Font Size</label>
                <span id="label-font-size" class="slider-val-text">${this.fontSize}px</span>
              </div>
              <input type="range" id="slider-font-size" min="28" max="64" value="${this.fontSize}" class="quote-slider" />
            </div>

            <!-- 5. Export Actions -->
            <div class="modal-actions-footer">
              <button id="btn-copy-card-image" class="btn btn-secondary btn-full">
                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                <span id="txt-copy-image">Copy Image to Clipboard</span>
              </button>
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

    // Font family buttons
    this.container.querySelectorAll<HTMLButtonElement>(".typo-toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const font = btn.getAttribute("data-font") as FontStyle | null;
        if (font) {
          this.fontStyle = font;
          this.container.querySelectorAll(".typo-toggle-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          this.renderCanvas();
        }
      });
    });

    // Text Align buttons
    this.container.querySelectorAll<HTMLButtonElement>(".align-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const align = btn.getAttribute("data-align") as TextAlign | null;
        if (align) {
          this.textAlign = align;
          this.container.querySelectorAll(".align-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          this.renderCanvas();
        }
      });
    });

    // Font size slider
    const sFont = this.container.querySelector("#slider-font-size") as HTMLInputElement | null;
    sFont?.addEventListener("input", () => {
      this.fontSize = Number(sFont.value);
      const label = this.container.querySelector("#label-font-size");
      if (label) label.textContent = `${this.fontSize}px`;
      this.renderCanvas();
    });

    // Copy Image to Clipboard action
    this.container.querySelector("#btn-copy-card-image")?.addEventListener("click", () => this.copyToClipboard());

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
    } else if (this.currentRatio === "4:5") {
      width = 1080;
      height = 1350;
    }

    this.canvas.width = width;
    this.canvas.height = height;

    // 1. Render Background Theme Gradient
    if (this.currentTheme === "obsidian") {
      const grad = this.ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#080b12");
      grad.addColorStop(0.5, "#151829");
      grad.addColorStop(1, "#07090e");
      this.ctx.fillStyle = grad;
    } else if (this.currentTheme === "sunset") {
      const grad = this.ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#1c0b14");
      grad.addColorStop(0.5, "#3d1425");
      grad.addColorStop(1, "#18070f");
      this.ctx.fillStyle = grad;
    } else if (this.currentTheme === "emerald") {
      const grad = this.ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#051411");
      grad.addColorStop(0.5, "#0a2b24");
      grad.addColorStop(1, "#04110e");
      this.ctx.fillStyle = grad;
    } else {
      this.ctx.fillStyle = "#0c1017";
    }

    this.ctx.fillRect(0, 0, width, height);

    // 2. Draw Decorative Ambient Radial Glow Orbs
    const accentColor =
      this.currentTheme === "sunset"
        ? "#f43f5e"
        : this.currentTheme === "emerald"
        ? "#10b981"
        : this.currentTheme === "minimal"
        ? "#38bdf8"
        : "#a855f7";

    const radialGlow = this.ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, width * 0.6);
    radialGlow.addColorStop(0, this.currentTheme === "sunset" ? "rgba(244, 63, 94, 0.15)" : this.currentTheme === "emerald" ? "rgba(16, 185, 129, 0.15)" : "rgba(168, 85, 247, 0.18)");
    radialGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    this.ctx.fillStyle = radialGlow;
    this.ctx.fillRect(0, 0, width, height);

    // 3. Border Framing
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(40, 40, width - 80, height - 80);

    // 4. Header Badge
    this.ctx.textAlign = "left";
    this.ctx.font = "700 24px -apple-system, Inter, sans-serif";
    this.ctx.fillStyle = accentColor;
    this.ctx.fillText("HAKIM INTELLIGENCE", 80, 105);

    this.ctx.font = "600 30px -apple-system, Inter, sans-serif";
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    this.ctx.fillText(`📖 ${this.currentHighlight.bookTitle}`, 80, 155);

    // 5. Large Quote Glyph
    this.ctx.font = "bold 130px Georgia, serif";
    this.ctx.fillStyle = accentColor;
    this.ctx.globalAlpha = 0.35;
    this.ctx.fillText("“", 75, 280);
    this.ctx.globalAlpha = 1.0;

    // 6. Quote Body Text with Word Wrapping & Alignment
    const paddingX = 90;
    const maxTextWidth = width - paddingX * 2;
    const lineHeight = this.fontSize * 1.55;
    const fontFamily = this.fontStyle === "serif" ? "Newsreader, Georgia, serif" : "Inter, -apple-system, sans-serif";
    this.ctx.font = `italic 500 ${this.fontSize}px ${fontFamily}`;
    this.ctx.fillStyle = "#ffffff";
    this.ctx.textAlign = this.textAlign;

    const words = this.currentHighlight.rawText.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (let i = 0; i < words.length; i++) {
      const testLine = currentLine + words[i] + " ";
      const metrics = this.ctx.measureText(testLine);
      if (metrics.width > maxTextWidth && i > 0) {
        lines.push(currentLine.trim());
        currentLine = words[i] + " ";
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine.trim());

    // Calculate vertical centering
    const totalTextHeight = lines.length * lineHeight;
    let startY = Math.max(340, (height - totalTextHeight) / 2);

    lines.forEach((lineText) => {
      const posX = this.textAlign === "center" ? width / 2 : this.textAlign === "right" ? width - paddingX : paddingX;
      this.ctx.fillText(lineText, posX, startY);
      startY += lineHeight;
    });

    // 7. Footer Metadata
    const footerY = height - 90;
    this.ctx.textAlign = "left";
    this.ctx.font = "500 22px -apple-system, Inter, sans-serif";
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    const locText = this.currentHighlight.location ? `Location ${this.currentHighlight.location}` : "Personal Annotation";
    this.ctx.fillText(locText, paddingX, footerY);

    this.ctx.textAlign = "right";
    this.ctx.fillText("hakim-reading.vercel.app", width - paddingX, footerY);
    this.ctx.textAlign = "left";
  }

  public async copyToClipboard(): Promise<void> {
    const txtSpan = this.container.querySelector("#txt-copy-image");
    if (!navigator.clipboard || !window.ClipboardItem) {
      if (txtSpan) txtSpan.textContent = "Clipboard API not supported in browser";
      return;
    }

    try {
      this.canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        if (txtSpan) {
          txtSpan.textContent = "✓ Image Copied to Clipboard!";
          setTimeout(() => {
            txtSpan.textContent = "Copy Image to Clipboard";
          }, 2200);
        }
      });
    } catch (e) {
      if (txtSpan) txtSpan.textContent = "Error copying image";
    }
  }

  public downloadPNG(): void {
    const dataUrl = this.canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `hakim-quote-${this.currentHighlight?.bookTitle.toLowerCase().replace(/\s+/g, "-") || "card"}.png`;
    link.href = dataUrl;
    link.click();
  }
}
