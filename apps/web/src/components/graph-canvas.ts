import type { GraphData, GraphNode, GraphLink } from "../core/types.js";

interface SimulationNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isDragging?: boolean;
}

interface SimulationLink extends GraphLink {
  sourceNode?: SimulationNode;
  targetNode?: SimulationNode;
}

export class CanvasGraphEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLElement;

  private nodes: SimulationNode[] = [];
  private links: SimulationLink[] = [];
  private nodeMap = new Map<string, SimulationNode>();

  // Physics params
  private alpha = 1;
  private alphaMin = 0.001;
  private alphaDecay = 0.022;
  private isSimulationRunning = true;

  // Transform (Pan & Zoom)
  private scale = 1;
  private minScale = 0.2;
  private maxScale = 4.0;
  private offsetX = 0;
  private offsetY = 0;

  // Interaction State
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private hoveredNode: SimulationNode | null = null;
  private draggedNode: SimulationNode | null = null;
  private onNodeClickCallback?: (node: GraphNode) => void;

  private animationFrameId: number | null = null;

  constructor(container: HTMLElement, onNodeClick?: (node: GraphNode) => void) {
    this.container = container;
    this.onNodeClickCallback = onNodeClick;

    this.canvas = document.createElement("canvas");
    this.canvas.className = "graph-canvas";
    this.container.appendChild(this.canvas);

    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("Could not get 2D context from canvas.");
    this.ctx = context;

    this.resize();
    this.initEvents();
  }

  public setData(data: GraphData): void {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    this.nodeMap.clear();

    // Preserve existing node positions if present, or distribute organically
    this.nodes = data.nodes.map((n, i) => {
      const existing = this.nodes.find((old) => old.id === n.id);
      const angle = (i / Math.max(1, data.nodes.length)) * 2 * Math.PI;
      const dist = n.type === "book" ? 120 : n.type === "topic" ? 220 : 280 + (i % 5) * 20;

      const simNode: SimulationNode = {
        ...n,
        x: existing ? existing.x : width / 2 + Math.cos(angle) * dist + (Math.random() - 0.5) * 40,
        y: existing ? existing.y : height / 2 + Math.sin(angle) * dist + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
        radius: n.size || (n.type === "book" ? 22 : n.type === "topic" ? 16 : 8),
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
      if (this.isSimulationRunning) {
        this.tick();
      }
      this.render();
      this.animationFrameId = requestAnimationFrame(step);
    };

    this.animationFrameId = requestAnimationFrame(step);
  }

  /**
   * Velocity Verlet force integration with Hooke spring attraction and Coulomb repulsion.
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
    const gravity = 0.035 * this.alpha;
    for (const node of this.nodes) {
      node.vx += (centerX - node.x) * gravity;
      node.vy += (centerY - node.y) * gravity;
    }

    // 2. Node Repulsion (Coulomb force)
    const repulsion = 450 * this.alpha;
    for (let i = 0; i < this.nodes.length; i++) {
      const nodeA = this.nodes[i]!;
      for (let j = i + 1; j < this.nodes.length; j++) {
        const nodeB = this.nodes[j]!;
        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        let distSq = dx * dx + dy * dy;
        if (distSq === 0) distSq = 1;

        const dist = Math.sqrt(distSq);
        const minDist = nodeA.radius + nodeB.radius + 15;

        // Repulsion force
        const force = (repulsion / distSq) * (nodeA.type === "book" || nodeB.type === "book" ? 2.5 : 1.0);
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
          const overlap = (minDist - dist) * 0.5 * this.alpha;
          const sx = (dx / dist) * overlap;
          const sy = (dy / dist) * overlap;
          if (!nodeA.isDragging) { nodeA.x -= sx; nodeA.y -= sy; }
          if (!nodeB.isDragging) { nodeB.x += sx; nodeB.y += sy; }
        }
      }
    }

    // 3. Link Attraction (Hooke spring force)
    for (const link of this.links) {
      if (!link.sourceNode || !link.targetNode) continue;
      const source = link.sourceNode;
      const target = link.targetNode;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const targetDist = link.type === "contains" ? 90 : 160;
      const strength = (link.strength || 0.5) * 0.12 * this.alpha;

      const displacement = (dist - targetDist) * strength;
      const fx = (dx / dist) * displacement;
      const fy = (dy / dist) * displacement;

      if (!source.isDragging) { source.vx += fx; source.vy += fy; }
      if (!target.isDragging) { target.vx -= fx; target.vy -= fy; }
    }

    // 4. Velocity damping & Position integration
    const damping = 0.65;
    for (const node of this.nodes) {
      if (node.isDragging) continue;
      node.vx *= damping;
      node.vy *= damping;
      node.x += node.vx;
      node.y += node.vy;
    }

    this.alpha += (0 - this.alpha) * this.alphaDecay;
  }

  public render(): void {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    this.ctx.clearRect(0, 0, width, height);

    this.ctx.save();
    // Apply Pan & Zoom Transform
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.scale, this.scale);

    // Draw Links
    for (const link of this.links) {
      if (!link.sourceNode || !link.targetNode) continue;
      const isHighlighted =
        this.hoveredNode &&
        (link.sourceNode.id === this.hoveredNode.id || link.targetNode.id === this.hoveredNode.id);

      this.ctx.beginPath();
      this.ctx.moveTo(link.sourceNode.x - width / 2, link.sourceNode.y - height / 2);
      this.ctx.lineTo(link.targetNode.x - width / 2, link.targetNode.y - height / 2);

      if (isHighlighted) {
        this.ctx.strokeStyle = "rgba(129, 140, 248, 0.85)";
        this.ctx.lineWidth = 2.0;
      } else {
        this.ctx.strokeStyle =
          link.type === "shares_topic" ? "rgba(56, 189, 248, 0.18)" : "rgba(255, 255, 255, 0.08)";
        this.ctx.lineWidth = link.type === "contains" ? 1.2 : 0.8;
      }
      this.ctx.stroke();
    }

    // Draw Nodes
    for (const node of this.nodes) {
      const nx = node.x - width / 2;
      const ny = node.y - height / 2;
      const isHovered = this.hoveredNode?.id === node.id;
      const isDimmed = this.hoveredNode && !isHovered && !this.areNodesConnected(node, this.hoveredNode);

      this.ctx.save();
      this.ctx.globalAlpha = isDimmed ? 0.25 : 1.0;

      // Glow effect for books & hovered items
      if (node.type === "book" || isHovered) {
        this.ctx.beginPath();
        this.ctx.arc(nx, ny, node.radius + 6, 0, 2 * Math.PI);
        this.ctx.fillStyle = node.type === "book" ? "rgba(99, 102, 241, 0.25)" : "rgba(255, 255, 255, 0.2)";
        this.ctx.fill();
      }

      // Node Body Circle
      this.ctx.beginPath();
      this.ctx.arc(nx, ny, node.radius, 0, 2 * Math.PI);
      this.ctx.fillStyle = node.color;
      this.ctx.fill();
      this.ctx.strokeStyle = isHovered ? "#ffffff" : "rgba(255, 255, 255, 0.25)";
      this.ctx.lineWidth = isHovered ? 2.5 : 1.2;
      this.ctx.stroke();

      // Node Label
      this.ctx.font = node.type === "book" ? "bold 12px Inter, sans-serif" : node.type === "topic" ? "600 11px Inter, sans-serif" : "10px Inter, sans-serif";
      this.ctx.fillStyle = isHovered ? "#ffffff" : node.type === "book" ? "#e0e7ff" : "rgba(255, 255, 255, 0.85)";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "top";

      // Truncate label for satellite highlights
      let displayLabel = node.label;
      if (node.type === "highlight" && displayLabel.length > 24) {
        displayLabel = displayLabel.substring(0, 22) + "...";
      }

      this.ctx.fillText(displayLabel, nx, ny + node.radius + 4);

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

    // Transform screen coordinates into graph coordinate space
    const graphX = (screenX - this.offsetX) / this.scale + width / 2;
    const graphY = (screenY - this.offsetY) / this.scale + height / 2;

    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const node = this.nodes[i]!;
      const dx = graphX - node.x;
      const dy = graphY - node.y;
      if (dx * dx + dy * dy <= (node.radius + 4) * (node.radius + 4)) {
        return node;
      }
    }
    return null;
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
        this.alpha = Math.max(this.alpha, 0.3);
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
        this.alpha = 0.5;
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

    // Click on Node
    this.canvas.addEventListener("click", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const hit = this.getNodeAtPosition(mouseX, mouseY);
      if (hit && this.onNodeClickCallback) {
        this.onNodeClickCallback(hit);
      }
    });

    // Wheel Zoom
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
      const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * zoomFactor));

      this.offsetX = mouseX - (mouseX - this.offsetX) * (newScale / this.scale);
      this.offsetY = mouseY - (mouseY - this.offsetY) * (newScale / this.scale);
      this.scale = newScale;
    }, { passive: false });
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
    this.offsetX = (rect.width || 800) / 2;
    this.offsetY = (rect.height || 600) / 2;
    this.alpha = 1;
  }

  public togglePhysics(): boolean {
    this.isSimulationRunning = !this.isSimulationRunning;
    return this.isSimulationRunning;
  }
}
