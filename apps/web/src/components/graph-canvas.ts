import type { GraphData, GraphNode, GraphLink, AnnotationColor } from "../core/types.js";

export interface SimulationNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isDragging?: boolean;
}

export interface SimulationLink extends GraphLink {
  sourceNode?: SimulationNode;
  targetNode?: SimulationNode;
}

export interface GraphPhysicsConfig {
  gravity: number;
  repulsion: number;
  linkDistance: number;
  linkStrength: number;
  damping: number;
  nodeSizeMultiplier: number;
  showLabels: boolean;
  showParticles: boolean;
}

export class CanvasGraphEngine {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private nodes: SimulationNode[] = [];
  private links: SimulationLink[] = [];
  private nodeMap = new Map<string, SimulationNode>();

  // Physics Simulation
  private alpha = 1;
  private alphaMin = 0.0005;
  private alphaDecay = 0.015;
  private isSimulationRunning = true;

  // Obsidian Physics Controls - Calibrated for spacious constellation feel
  public config: GraphPhysicsConfig = {
    gravity: 0.008,
    repulsion: 1400,
    linkDistance: 160,
    linkStrength: 0.12,
    damping: 0.88,
    nodeSizeMultiplier: 1.0,
    showLabels: true,
    showParticles: true,
  };

  // Transform (Pan & Zoom)
  private scale = 1;
  private minScale = 0.15;
  private maxScale = 5.0;
  private offsetX = 0;
  private offsetY = 0;

  // Target Camera for smooth interpolation (Fly-to)
  private targetScale: number | null = null;
  private targetOffsetX: number | null = null;
  private targetOffsetY: number | null = null;

  // Interaction State
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private hoveredNode: SimulationNode | null = null;
  private selectedNode: SimulationNode | null = null;
  private draggedNode: SimulationNode | null = null;
  private onNodeClickCallback?: (node: GraphNode) => void;

  // Starfield Grid particles
  private starfieldGrid: Array<{ x: number; y: number; opacity: number; size: number }> = [];

  private animationFrameId: number | null = null;
  private hudElement: HTMLElement | null = null;

  constructor(container: HTMLElement, onNodeClick?: (node: GraphNode) => void) {
    this.container = container;
    this.onNodeClickCallback = onNodeClick;

    this.canvas = document.createElement("canvas");
    this.canvas.className = "graph-canvas";
    this.container.appendChild(this.canvas);

    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("Could not get 2D context from canvas.");
    this.ctx = context;

    this.initStarfield();
    this.resize();
    this.initEvents();
    this.createObsidianHUD();
  }

  private initStarfield(): void {
    this.starfieldGrid = [];
    for (let i = 0; i < 140; i++) {
      this.starfieldGrid.push({
        x: (Math.random() - 0.5) * 4000,
        y: (Math.random() - 0.5) * 4000,
        opacity: 0.15 + Math.random() * 0.35,
        size: 0.8 + Math.random() * 1.5,
      });
    }
  }

  public setData(data: GraphData): void {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    this.nodeMap.clear();

    const bookNodes = data.nodes.filter((n) => n.type === "book");
    const otherNodes = data.nodes.filter((n) => n.type !== "book");

    // Distribute Books in a wide outer perimeter
    const bookPositions = new Map<string, { x: number; y: number }>();
    bookNodes.forEach((b, idx) => {
      const angle = (idx / Math.max(1, bookNodes.length)) * 2 * Math.PI - Math.PI / 2;
      const radius = 340 + (idx % 2) * 50;
      bookPositions.set(b.id, {
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
      });
    });

    this.nodes = data.nodes.map((n, i) => {
      const existing = this.nodes.find((old) => old.id === n.id);
      const baseRadius = n.size || (n.type === "book" ? 26 : n.type === "topic" ? 16 : 8);

      let initX = width / 2;
      let initY = height / 2;

      if (existing) {
        initX = existing.x;
        initY = existing.y;
      } else if (n.type === "book") {
        const pos = bookPositions.get(n.id) || { x: width / 2, y: height / 2 };
        initX = pos.x;
        initY = pos.y;
      } else if (n.type === "topic") {
        const angle = (i / Math.max(1, data.nodes.length)) * 2 * Math.PI;
        initX = width / 2 + Math.cos(angle) * 180 + (Math.random() - 0.5) * 60;
        initY = height / 2 + Math.sin(angle) * 180 + (Math.random() - 0.5) * 60;
      } else {
        // Highlight satellite around linked book or center
        const angle = Math.random() * 2 * Math.PI;
        const dist = 80 + Math.random() * 90;
        initX = width / 2 + Math.cos(angle) * dist + (Math.random() - 0.5) * 100;
        initY = height / 2 + Math.sin(angle) * dist + (Math.random() - 0.5) * 100;
      }

      const simNode: SimulationNode = {
        ...n,
        x: initX,
        y: initY,
        vx: existing ? existing.vx : (Math.random() - 0.5) * 2,
        vy: existing ? existing.vy : (Math.random() - 0.5) * 2,
        radius: baseRadius,
      };

      this.nodeMap.set(n.id, simNode);
      return simNode;
    });

    // Map link node references
    this.links = data.links.map((l) => ({
      ...l,
      sourceNode: this.nodeMap.get(typeof l.source === "string" ? l.source : (l.source as any).id),
      targetNode: this.nodeMap.get(typeof l.target === "string" ? l.target : (l.target as any).id),
    }));

    this.alpha = 1;
    this.startSimulation();
  }

  private resize(): void {
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width || 800;
    const height = rect.height || 600;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.scale(dpr, dpr);

    if (this.offsetX === 0 && this.offsetY === 0) {
      this.offsetX = width / 2;
      this.offsetY = height / 2;
    }
  }

  private startSimulation(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    const step = () => {
      // Smooth Camera Fly-To interpolation
      if (this.targetScale !== null && this.targetOffsetX !== null && this.targetOffsetY !== null) {
        this.scale += (this.targetScale - this.scale) * 0.12;
        this.offsetX += (this.targetOffsetX - this.offsetX) * 0.12;
        this.offsetY += (this.targetOffsetY - this.offsetY) * 0.12;

        if (
          Math.abs(this.scale - this.targetScale) < 0.005 &&
          Math.abs(this.offsetX - this.targetOffsetX) < 0.5 &&
          Math.abs(this.offsetY - this.targetOffsetY) < 0.5
        ) {
          this.scale = this.targetScale;
          this.offsetX = this.targetOffsetX;
          this.offsetY = this.targetOffsetY;
          this.targetScale = null;
          this.targetOffsetX = null;
          this.targetOffsetY = null;
        }
      }

      if (this.isSimulationRunning) {
        this.tick();
      }
      this.render();
      this.animationFrameId = requestAnimationFrame(step);
    };

    this.animationFrameId = requestAnimationFrame(step);
  }

  /**
   * Obsidian-grade Velocity Verlet force integration.
   */
  public tick(): void {
    if (this.alpha < this.alphaMin) {
      return;
    }

    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);
    const centerX = width / 2;
    const centerY = height / 2;

    // 1. Center gravity pull
    const gravity = this.config.gravity * this.alpha;
    for (const node of this.nodes) {
      node.vx += (centerX - node.x) * gravity;
      node.vy += (centerY - node.y) * gravity;
    }

    // 2. Node Repulsion (Coulomb Inverse-Square force)
    const repulsion = this.config.repulsion * this.alpha;
    for (let i = 0; i < this.nodes.length; i++) {
      const nodeA = this.nodes[i]!;
      for (let j = i + 1; j < this.nodes.length; j++) {
        const nodeB = this.nodes[j]!;
        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        let distSq = dx * dx + dy * dy;
        if (distSq === 0) distSq = 1;

        const dist = Math.sqrt(distSq);
        const minDist = (nodeA.radius + nodeB.radius) * this.config.nodeSizeMultiplier + 36;

        // Repulsion force
        const multiplier = nodeA.type === "book" || nodeB.type === "book" ? 3.5 : 1.4;
        const force = (repulsion / distSq) * multiplier;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (!nodeA.isDragging) {
          nodeA.vx -= fx;
          nodeA.vy -= fy;
        }
        if (!nodeB.isDragging) {
          nodeB.vx += fx;
          nodeB.vy += fy;
        }

        // Collision separation
        if (dist < minDist) {
          const overlap = (minDist - dist) * 0.7 * this.alpha;
          const sx = (dx / dist) * overlap;
          const sy = (dy / dist) * overlap;
          if (!nodeA.isDragging) { nodeA.x -= sx; nodeA.y -= sy; }
          if (!nodeB.isDragging) { nodeB.x += sx; nodeB.y += sy; }
        }
      }
    }

    // 3. Link Attraction (Hooke spring relaxation)
    for (const link of this.links) {
      if (!link.sourceNode || !link.targetNode) continue;
      const source = link.sourceNode;
      const target = link.targetNode;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const targetDist = link.type === "contains" ? this.config.linkDistance : this.config.linkDistance * 1.6;
      const strength = (link.strength || 0.5) * this.config.linkStrength * this.alpha;

      const displacement = (dist - targetDist) * strength;
      const fx = (dx / dist) * displacement;
      const fy = (dy / dist) * displacement;

      if (!source.isDragging) {
        source.vx += fx;
        source.vy += fy;
      }
      if (!target.isDragging) {
        target.vx -= fx;
        target.vy -= fy;
      }
    }

    // 4. Update Node Positions with Exponential Damping
    for (const node of this.nodes) {
      if (node.isDragging) continue;

      node.vx *= this.config.damping;
      node.vy *= this.config.damping;

      node.x += node.vx;
      node.y += node.vy;
    }

    // Alpha decay
    this.alpha *= 1 - this.alphaDecay;
  }

  public render(): void {
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;

    this.ctx.clearRect(0, 0, width, height);

    // 1. Render Cosmic Deep Canvas Background
    this.ctx.fillStyle = "#0a0d14";
    this.ctx.fillRect(0, 0, width, height);

    // 2. Render Parallax Starfield Particles
    if (this.config.showParticles) {
      this.ctx.save();
      for (const p of this.starfieldGrid) {
        const px = ((p.x * this.scale + this.offsetX) % width + width) % width;
        const py = ((p.y * this.scale + this.offsetY) % height + height) % height;

        this.ctx.beginPath();
        this.ctx.arc(px, py, p.size, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(168, 185, 247, ${p.opacity * Math.min(1, this.scale)})`;
        this.ctx.fill();
      }
      this.ctx.restore();
    }

    this.ctx.save();
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.scale, this.scale);
    this.ctx.translate(-width / 2, -height / 2);

    const activeNode = this.hoveredNode || this.selectedNode;

    // 3. Render Links
    for (const link of this.links) {
      if (!link.sourceNode || !link.targetNode) continue;
      const source = link.sourceNode;
      const target = link.targetNode;

      const isConnected =
        activeNode &&
        (source.id === activeNode.id || target.id === activeNode.id);

      this.ctx.beginPath();
      this.ctx.moveTo(source.x, source.y);
      this.ctx.lineTo(target.x, target.y);

      if (isConnected) {
        this.ctx.strokeStyle = "rgba(168, 85, 247, 0.85)";
        this.ctx.lineWidth = (link.type === "contains" ? 2.5 : 1.8) / Math.sqrt(this.scale);
      } else {
        const isDimmed = activeNode !== null;
        this.ctx.strokeStyle = isDimmed
          ? "rgba(255, 255, 255, 0.03)"
          : link.type === "contains"
          ? "rgba(255, 255, 255, 0.12)"
          : "rgba(56, 189, 248, 0.18)";
        this.ctx.lineWidth = (link.type === "contains" ? 1.2 : 0.8) / Math.sqrt(this.scale);
      }

      this.ctx.stroke();
    }

    // 4. Render Nodes with Obsidian-grade Glowing Halos
    for (const node of this.nodes) {
      const isHovered = this.hoveredNode?.id === node.id;
      const isSelected = this.selectedNode?.id === node.id;
      const isConnectedToActive = activeNode ? this.areNodesConnected(node, activeNode) : false;
      const isDimmed = activeNode !== null && !isHovered && !isSelected && !isConnectedToActive;

      const nx = node.x;
      const ny = node.y;
      const r = node.radius * this.config.nodeSizeMultiplier;

      this.ctx.save();
      this.ctx.globalAlpha = isDimmed ? 0.2 : 1.0;

      // Radiant Multi-Tier Halos
      let coreColor = "#6366f1";
      let haloColor = "rgba(99, 102, 241, 0.25)";

      if (node.type === "book") {
        coreColor = "#a855f7";
        haloColor = "rgba(168, 85, 247, 0.35)";
      } else if (node.type === "topic") {
        coreColor = "#06b6d4";
        haloColor = "rgba(6, 182, 212, 0.3)";
      } else if (node.color === "yellow") {
        coreColor = "#f59e0b";
        haloColor = "rgba(245, 158, 11, 0.25)";
      } else if (node.color === "blue") {
        coreColor = "#38bdf8";
        haloColor = "rgba(56, 189, 248, 0.25)";
      } else if (node.color === "pink") {
        coreColor = "#f43f5e";
        haloColor = "rgba(244, 63, 94, 0.25)";
      } else if (node.color === "orange") {
        coreColor = "#fb923c";
        haloColor = "rgba(251, 146, 60, 0.25)";
      }

      // Outer Halo Glow
      const haloRadius = (isHovered || isSelected ? r * 2.4 : r * 1.6) / Math.sqrt(this.scale);
      const grad = this.ctx.createRadialGradient(nx, ny, r * 0.5, nx, ny, haloRadius);
      grad.addColorStop(0, haloColor);
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(nx, ny, haloRadius, 0, Math.PI * 2);
      this.ctx.fill();

      // Double Concentric Ring for Books
      if (node.type === "book") {
        this.ctx.beginPath();
        this.ctx.arc(nx, ny, r + 5 / Math.sqrt(this.scale), 0, Math.PI * 2);
        this.ctx.strokeStyle = isHovered || isSelected ? "#ffffff" : "rgba(168, 85, 247, 0.6)";
        this.ctx.lineWidth = 2 / Math.sqrt(this.scale);
        this.ctx.stroke();
      }

      // Main Node Orb
      this.ctx.beginPath();
      this.ctx.arc(nx, ny, r, 0, Math.PI * 2);
      this.ctx.fillStyle = coreColor;
      this.ctx.fill();

      this.ctx.strokeStyle = isHovered || isSelected ? "#ffffff" : "rgba(255, 255, 255, 0.35)";
      this.ctx.lineWidth = (isHovered ? 2.5 : 1.2) / Math.sqrt(this.scale);
      this.ctx.stroke();

      // Clean Level of Detail (LOD) Labels without clumping
      const shouldShowLabel =
        this.config.showLabels &&
        (node.type === "book" || node.type === "topic" || isHovered || isSelected || isConnectedToActive || this.scale > 1.8);

      if (shouldShowLabel) {
        const fontSize = node.type === "book" ? 13 : node.type === "topic" ? 11.5 : 10;
        this.ctx.font = `${node.type === "book" ? "700" : "600"} ${fontSize / Math.sqrt(this.scale)}px Inter, sans-serif`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "top";

        // Truncate label if necessary
        let displayLabel = node.label;
        if (node.type === "highlight" && displayLabel.length > 24) {
          displayLabel = displayLabel.substring(0, 22) + "...";
        }

        // Label Pill
        const labelY = ny + r + (4 / Math.sqrt(this.scale));
        this.ctx.fillStyle = "rgba(10, 13, 20, 0.85)";
        const textMetrics = this.ctx.measureText(displayLabel);
        const padX = 5 / Math.sqrt(this.scale);
        const padY = 2.5 / Math.sqrt(this.scale);
        const textHeight = fontSize / Math.sqrt(this.scale);

        this.ctx.fillRect(
          nx - textMetrics.width / 2 - padX,
          labelY - padY,
          textMetrics.width + padX * 2,
          textHeight + padY * 2
        );

        this.ctx.fillStyle = isHovered || isSelected ? "#ffffff" : node.type === "book" ? "#f1f5f9" : node.type === "topic" ? "#67e8f9" : "rgba(255, 255, 255, 0.85)";
        this.ctx.fillText(displayLabel, nx, labelY);
      }

      this.ctx.restore();
    }

    this.ctx.restore();
  }

  private areNodesConnected(a: SimulationNode, b: SimulationNode): boolean {
    return this.links.some(
      (l) =>
        (l.sourceNode?.id === a.id && l.targetNode?.id === b.id) ||
        (l.sourceNode?.id === b.id && l.targetNode?.id === a.id)
    );
  }

  private getNodeAtPosition(screenX: number, screenY: number): SimulationNode | null {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    const graphX = (screenX - this.offsetX) / this.scale + width / 2;
    const graphY = (screenY - this.offsetY) / this.scale + height / 2;

    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const node = this.nodes[i]!;
      const dx = graphX - node.x;
      const dy = graphY - node.y;
      const r = node.radius * this.config.nodeSizeMultiplier + 6;
      if (dx * dx + dy * dy <= r * r) {
        return node;
      }
    }
    return null;
  }

  /**
   * Smoothly animates camera viewport to center and zoom in on a node.
   */
  public flyToNode(node: SimulationNode, targetZoom: number = 1.8): void {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    this.targetScale = targetZoom;
    this.targetOffsetX = width / 2 - (node.x - width / 2) * targetZoom;
    this.targetOffsetY = height / 2 - (node.y - height / 2) * targetZoom;
    this.selectedNode = node;
  }

  private createObsidianHUD(): void {
    this.hudElement = document.createElement("div");
    this.hudElement.className = "obsidian-graph-hud";
    this.hudElement.innerHTML = `
      <div class="hud-panel-header">
        <div class="hud-title-row">
          <span class="hud-icon">⚙️</span>
          <span class="hud-title">Graph Controls</span>
        </div>
        <button id="btn-toggle-hud" class="hud-btn-minimize" aria-label="Toggle HUD">—</button>
      </div>

      <div class="hud-body">
        <div class="hud-section">
          <span class="hud-section-label">Forces</span>
          <div class="hud-slider-group">
            <label>Repulsion <span id="val-repulsion">${this.config.repulsion}</span></label>
            <input type="range" id="slider-repulsion" min="300" max="2500" value="${this.config.repulsion}" />
          </div>
          <div class="hud-slider-group">
            <label>Link Distance <span id="val-distance">${this.config.linkDistance}</span></label>
            <input type="range" id="slider-distance" min="60" max="300" value="${this.config.linkDistance}" />
          </div>
          <div class="hud-slider-group">
            <label>Center Gravity <span id="val-gravity">${Math.round(this.config.gravity * 1000)}</span></label>
            <input type="range" id="slider-gravity" min="1" max="25" value="${Math.round(this.config.gravity * 1000)}" />
          </div>
        </div>

        <div class="hud-section">
          <span class="hud-section-label">Display</span>
          <div class="hud-toggle-row">
            <label><input type="checkbox" id="chk-labels" ${this.config.showLabels ? "checked" : ""} /> Show Labels</label>
            <label><input type="checkbox" id="chk-particles" ${this.config.showParticles ? "checked" : ""} /> Starfield Grid</label>
          </div>
        </div>

        <div class="hud-actions-row">
          <button id="btn-reset-camera" class="btn-hud-action">Reset View</button>
          <button id="btn-toggle-sim" class="btn-hud-action">Freeze</button>
        </div>
      </div>
    `;

    this.container.appendChild(this.hudElement);

    // Event Listeners for HUD controls
    const toggleBtn = this.hudElement.querySelector("#btn-toggle-hud");
    const hudBody = this.hudElement.querySelector(".hud-body") as HTMLElement | null;
    toggleBtn?.addEventListener("click", () => {
      if (hudBody) {
        hudBody.style.display = hudBody.style.display === "none" ? "flex" : "none";
        toggleBtn.textContent = hudBody.style.display === "none" ? "+" : "—";
      }
    });

    const sRep = this.hudElement.querySelector("#slider-repulsion") as HTMLInputElement | null;
    sRep?.addEventListener("input", () => {
      this.config.repulsion = Number(sRep.value);
      const val = this.hudElement?.querySelector("#val-repulsion");
      if (val) val.textContent = sRep.value;
      this.alpha = Math.max(this.alpha, 0.4);
    });

    const sDist = this.hudElement.querySelector("#slider-distance") as HTMLInputElement | null;
    sDist?.addEventListener("input", () => {
      this.config.linkDistance = Number(sDist.value);
      const val = this.hudElement?.querySelector("#val-distance");
      if (val) val.textContent = sDist.value;
      this.alpha = Math.max(this.alpha, 0.4);
    });

    const sGrav = this.hudElement.querySelector("#slider-gravity") as HTMLInputElement | null;
    sGrav?.addEventListener("input", () => {
      this.config.gravity = Number(sGrav.value) / 1000;
      const val = this.hudElement?.querySelector("#val-gravity");
      if (val) val.textContent = sGrav.value;
      this.alpha = Math.max(this.alpha, 0.4);
    });

    const chkLabels = this.hudElement.querySelector("#chk-labels") as HTMLInputElement | null;
    chkLabels?.addEventListener("change", () => {
      this.config.showLabels = chkLabels.checked;
    });

    const chkPart = this.hudElement.querySelector("#chk-particles") as HTMLInputElement | null;
    chkPart?.addEventListener("change", () => {
      this.config.showParticles = chkPart.checked;
    });

    this.hudElement.querySelector("#btn-reset-camera")?.addEventListener("click", () => this.resetView());
    const btnSim = this.hudElement.querySelector("#btn-toggle-sim") as HTMLButtonElement | null;
    btnSim?.addEventListener("click", () => {
      const running = this.togglePhysics();
      if (btnSim) btnSim.textContent = running ? "Freeze" : "Unfreeze";
    });
  }

  private initEvents(): void {
    window.addEventListener("resize", () => this.resize());

    // Mouse Move & Hover
    this.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (this.draggedNode) {
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);
        this.draggedNode.x = (mouseX - this.offsetX) / this.scale + width / 2;
        this.draggedNode.y = (mouseY - this.offsetY) / this.scale + height / 2;
        this.alpha = Math.max(this.alpha, 0.4);
        return;
      }

      if (this.isPanning) {
        this.offsetX += mouseX - this.panStartX;
        this.offsetY += mouseY - this.panStartY;
        this.panStartX = mouseX;
        this.panStartY = mouseY;
        return;
      }

      const hit = this.getNodeAtPosition(mouseX, mouseY);
      this.hoveredNode = hit;
      this.canvas.style.cursor = hit ? "pointer" : "grab";
    });

    // Mouse Down (Drag or Pan)
    this.canvas.addEventListener("mousedown", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const hit = this.getNodeAtPosition(mouseX, mouseY);
      if (hit) {
        this.draggedNode = hit;
        hit.isDragging = true;
        this.alpha = 0.6;
      } else {
        this.isPanning = true;
        this.panStartX = mouseX;
        this.panStartY = mouseY;
        this.canvas.style.cursor = "grabbing";
      }
    });

    // Mouse Up
    window.addEventListener("mouseup", (e) => {
      if (this.draggedNode) {
        this.draggedNode.isDragging = false;
        this.draggedNode = null;
      }
      this.isPanning = false;
      this.canvas.style.cursor = this.hoveredNode ? "pointer" : "grab";
    });

    // Click on Node (Fly to node & trigger callback)
    this.canvas.addEventListener("click", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const hit = this.getNodeAtPosition(mouseX, mouseY);
      if (hit) {
        this.flyToNode(hit);
        if (this.onNodeClickCallback) {
          this.onNodeClickCallback(hit);
        }
      } else {
        this.selectedNode = null;
      }
    });

    // Wheel Zoom with cursor focal centering
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.14 : 0.86;
      const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * zoomFactor));

      this.offsetX = mouseX - (mouseX - this.offsetX) * (newScale / this.scale);
      this.offsetY = mouseY - (mouseY - this.offsetY) * (newScale / this.scale);
      this.scale = newScale;
    }, { passive: false });

    // Touch Support for Mobile & Tablets (Touch Pan, Node Drag, Pinch Zoom)
    let initialPinchDist: number | null = null;
    let initialPinchScale = 1;

    this.canvas.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0]!;
        const rect = this.canvas.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;

        const hit = this.getNodeAtPosition(touchX, touchY);
        if (hit) {
          this.draggedNode = hit;
          hit.isDragging = true;
          this.alpha = 0.6;
        } else {
          this.isPanning = true;
          this.panStartX = touchX;
          this.panStartY = touchY;
        }
      } else if (e.touches.length === 2) {
        const t1 = e.touches[0]!;
        const t2 = e.touches[1]!;
        initialPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        initialPinchScale = this.scale;
      }
    }, { passive: true });

    this.canvas.addEventListener("touchmove", (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0]!;
        const rect = this.canvas.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;

        if (this.draggedNode) {
          const width = this.canvas.width / (window.devicePixelRatio || 1);
          const height = this.canvas.height / (window.devicePixelRatio || 1);
          this.draggedNode.x = (touchX - this.offsetX) / this.scale + width / 2;
          this.draggedNode.y = (touchY - this.offsetY) / this.scale + height / 2;
          this.alpha = Math.max(this.alpha, 0.4);
          return;
        }

        if (this.isPanning) {
          this.offsetX += touchX - this.panStartX;
          this.offsetY += touchY - this.panStartY;
          this.panStartX = touchX;
          this.panStartY = touchY;
        }
      } else if (e.touches.length === 2 && initialPinchDist !== null) {
        const t1 = e.touches[0]!;
        const t2 = e.touches[1]!;
        const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const pinchRatio = currentDist / initialPinchDist;
        this.scale = Math.max(this.minScale, Math.min(this.maxScale, initialPinchScale * pinchRatio));
      }
    }, { passive: true });

    this.canvas.addEventListener("touchend", () => {
      if (this.draggedNode) {
        this.draggedNode.isDragging = false;
        this.draggedNode = null;
      }
      this.isPanning = false;
      initialPinchDist = null;
    });
  }

  public zoomIn(): void {
    this.scale = Math.min(this.maxScale, this.scale * 1.25);
  }

  public zoomOut(): void {
    this.scale = Math.max(this.minScale, this.scale * 0.8);
  }

  public resetView(): void {
    const rect = this.container.getBoundingClientRect();
    this.scale = 1;
    this.targetScale = null;
    this.targetOffsetX = null;
    this.targetOffsetY = null;
    this.offsetX = (rect.width || 800) / 2;
    this.offsetY = (rect.height || 600) / 2;
    this.selectedNode = null;
    this.alpha = 1;
  }

  public togglePhysics(): boolean {
    this.isSimulationRunning = !this.isSimulationRunning;
    if (this.isSimulationRunning) this.alpha = 0.5;
    return this.isSimulationRunning;
  }
}
