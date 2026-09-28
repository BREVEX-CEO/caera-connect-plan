/**
 * The central orb: a glass core inside a quiet sphere of points, with the
 * account's real graph growing out of it. Canvas 2D with a hand-rolled
 * perspective projection — no 3D library for a few hundred points. The glass
 * core, depth-sorted nodes and hover glow follow the latest UI reference; the
 * shell of points is ambient decoration and never stands for stored data.
 *
 * Categories differ by shape, not colour: conversations are circles, tasks
 * squares, memory diamonds, devices triangles, apps rings.
 *
 * Double-click toggles Orb Focus.
 *
 * Drag pans, the wheel or a pinch zooms, the pointer tilts the view, hover
 * names a node and a click selects it. Zooming in reveals individual records
 * (semantic zoom); zoomed out, each category is one hub. With reduced motion
 * there is no auto-rotation and nothing animates on its own.
 */
import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { Category, Graph, GraphNode } from "./graph";
import { cn } from "@/lib/utils";

const SHELL_POINTS = 160;
const DETAIL_ZOOM = 1.4;
const LABEL_ZOOM = 2.4;

function fibonacciSphere(count: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    out.push([Math.cos(golden * i) * r, y, Math.sin(golden * i) * r]);
  }
  return out;
}

const SHELL = fibonacciSphere(SHELL_POINTS);

function shape(
  context: CanvasRenderingContext2D,
  category: Category | undefined,
  x: number,
  y: number,
  r: number,
) {
  context.beginPath();
  if (category === "task") {
    context.rect(x - r, y - r, r * 2, r * 2);
  } else if (category === "memory") {
    context.moveTo(x, y - r * 1.25);
    context.lineTo(x + r * 1.25, y);
    context.lineTo(x, y + r * 1.25);
    context.lineTo(x - r * 1.25, y);
    context.closePath();
  } else if (category === "device") {
    context.moveTo(x, y - r * 1.3);
    context.lineTo(x + r * 1.2, y + r * 0.9);
    context.lineTo(x - r * 1.2, y + r * 0.9);
    context.closePath();
  } else {
    context.arc(x, y, r, 0, Math.PI * 2);
  }
}

/** True when the foreground is light, i.e. the page is dark. */
function darkPage(ink: string): boolean {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(ink);
  return m ? Number(m[1]) + Number(m[2]) + Number(m[3]) > 382 : true;
}

interface View {
  yaw: number;
  pitch: number;
  zoom: number;
  panX: number;
  panY: number;
}

export function Orb({
  graph,
  dimmed,
  level,
  accent,
  reducedMotion,
  selectedId,
  onSelect,
  onFocus,
  controlsHidden = false,
}: {
  graph: Graph;
  dimmed: boolean;
  /** 0–1 audio level while voice is active. */
  level: number;
  accent: string | null;
  reducedMotion: boolean;
  selectedId: string | null;
  onSelect(node: GraphNode): void;
  onFocus?(): void;
  controlsHidden?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef<View>({ yaw: 0.6, pitch: -0.25, zoom: 1, panX: 0, panY: 0 });
  const pointer = useRef({ x: 0, y: 0, inside: false });
  const projected = useRef<{ node: GraphNode; x: number; y: number; r: number }[]>([]);
  const levelRef = useRef(level);
  levelRef.current = level;
  const [hover, setHover] = useState<{ node: GraphNode; x: number; y: number } | null>(null);
  const hoverId = useRef<string | null>(null);
  hoverId.current = hover?.node.id ?? null;
  const [zoomShown, setZoomShown] = useState(1);
  const draw = useRef<() => void>(() => undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let frame = 0;
    let last = performance.now();

    const paint = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (
        canvas.width !== Math.round(rect.width * dpr) ||
        canvas.height !== Math.round(rect.height * dpr)
      ) {
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
      }
      const ink = accent || getComputedStyle(canvas).color;
      const v = view.current;
      const w = rect.width;
      const h = rect.height;
      const pulse = 1 + levelRef.current * 0.18;
      const radius = Math.min(w, h) * 0.28 * v.zoom * pulse;
      const cx = w / 2 + v.panX + (pointer.current.inside ? (pointer.current.x - w / 2) * 0.02 : 0);
      const cy = h / 2 + v.panY + (pointer.current.inside ? (pointer.current.y - h / 2) * 0.02 : 0);
      const tiltY = v.yaw + (pointer.current.inside ? (pointer.current.x / w - 0.5) * 0.35 : 0);
      const tiltX = v.pitch + (pointer.current.inside ? (pointer.current.y / h - 0.5) * 0.25 : 0);
      const cosY = Math.cos(tiltY);
      const sinY = Math.sin(tiltY);
      const cosX = Math.cos(tiltX);
      const sinX = Math.sin(tiltX);
      const project = ([x, y, z]: [number, number, number]) => {
        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;
        const y1 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;
        const depth = 3 / (3 + z2);
        return { x: cx + x1 * radius * depth, y: cy + y1 * radius * depth, depth, z: z2 };
      };

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, w, h);
      context.fillStyle = ink;
      context.strokeStyle = ink;

      const foreground = getComputedStyle(canvas).color;
      const dark = darkPage(foreground);
      const glow = context.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.4);
      context.globalAlpha = 0.1 + levelRef.current * 0.12;
      glow.addColorStop(0, ink);
      glow.addColorStop(1, "transparent");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(cx, cy, radius * 1.4, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = ink;

      // Ambient shell: decoration only, never a stored relationship.
      for (const point of SHELL) {
        const p = project(point);
        context.globalAlpha = 0.1 + (1 - p.z) * 0.16;
        context.beginPath();
        context.arc(p.x, p.y, 1.1 * p.depth, 0, Math.PI * 2);
        context.fill();
      }

      // Semantic zoom: categories until zoomed in, then every record.
      const shown = graph.nodes.filter(
        (n) => n.kind === "core" || n.kind === "hub" || v.zoom >= DETAIL_ZOOM,
      );
      const ids = new Set(shown.map((n) => n.id));
      const at = new Map<string, ReturnType<typeof project>>();
      for (const node of shown) at.set(node.id, project(node.position));
      const focus = hoverId.current ?? selectedId;

      for (const edge of graph.edges) {
        const a = at.get(edge.from);
        const b = at.get(edge.to);
        if (!a || !b || !ids.has(edge.from) || !ids.has(edge.to)) continue;
        const lit = focus !== null && (edge.from === focus || edge.to === focus);
        context.globalAlpha = lit ? 0.7 : 0.14 + levelRef.current * 0.2;
        context.lineWidth = lit ? 1.2 : 0.8;
        context.beginPath();
        context.moveTo(a.x, a.y);
        const mx = (a.x + b.x) / 2 + (cy - (a.y + b.y) / 2) * 0.08;
        const my = (a.y + b.y) / 2 + ((a.x + b.x) / 2 - cx) * 0.08;
        context.quadraticCurveTo(mx, my, b.x, b.y);
        context.stroke();
      }

      // Far nodes first, so near ones sit in front.
      const order = shown
        .filter((n) => n.kind !== "core")
        .sort((a, b) => at.get(b.id)!.z - at.get(a.id)!.z);
      const hits: typeof projected.current = [];
      for (const node of order) {
        const p = at.get(node.id)!;
        const lit = node.id === focus;
        const size = node.kind === "hub" ? 4 : 2.6;
        const r = size * p.depth * (node.id === selectedId ? 1.7 : 1);
        if (lit) {
          const halo = context.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4);
          halo.addColorStop(0, ink);
          halo.addColorStop(1, "transparent");
          context.globalAlpha = 0.35;
          context.fillStyle = halo;
          context.beginPath();
          context.arc(p.x, p.y, r * 4, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = ink;
        }
        context.globalAlpha = lit ? 1 : 0.35 + (1 - p.z) * 0.3;
        shape(context, node.category, p.x, p.y, r);
        if (node.kind === "hub" || node.category === "app") {
          context.lineWidth = 1.2;
          context.stroke();
          if (node.kind === "hub") context.fill();
        } else context.fill();
        if (node.id === selectedId) {
          context.globalAlpha = 0.8;
          context.beginPath();
          context.arc(p.x, p.y, r + 4, 0, Math.PI * 2);
          context.stroke();
        }
        const labelled = node.kind === "hub" || (v.zoom >= LABEL_ZOOM && node.kind !== "core");
        if (labelled) {
          context.globalAlpha = 0.7;
          context.font = "12px var(--font-sans), system-ui, sans-serif";
          context.fillText(node.label.slice(0, 28), p.x + r + 5, p.y + 4);
        }
        hits.push({ node, x: p.x, y: p.y, r: Math.max(10, r + 4) });
      }

      // The core: a silver-white glass sphere (docs/JARVIS_DESIGN_SYSTEM.md)
      // with a soft halo, a specular highlight and a rim light, breathing
      // with the voice level. Neutral silver on both themes.
      const core = radius * 0.24 * (1 + levelRef.current * 0.12);
      const halo = context.createRadialGradient(cx, cy, core * 0.8, cx, cy, core * 2.4);
      halo.addColorStop(0, dark ? "rgba(255,255,255,0.14)" : "rgba(120,120,120,0.18)");
      halo.addColorStop(1, "rgba(255,255,255,0)");
      context.globalAlpha = 1;
      context.fillStyle = halo;
      context.beginPath();
      context.arc(cx, cy, core * 2.4, 0, Math.PI * 2);
      context.fill();
      const body = context.createRadialGradient(
        cx - core * 0.35,
        cy - core * 0.4,
        core * 0.05,
        cx,
        cy,
        core,
      );
      body.addColorStop(0, "rgba(255,255,255,0.98)");
      body.addColorStop(0.35, dark ? "rgba(216,216,216,0.94)" : "rgba(230,230,230,0.97)");
      body.addColorStop(0.78, dark ? "rgba(140,140,140,0.9)" : "rgba(172,172,172,0.96)");
      body.addColorStop(1, dark ? "rgba(70,70,70,0.92)" : "rgba(118,118,118,0.96)");
      context.fillStyle = body;
      context.beginPath();
      context.arc(cx, cy, core, 0, Math.PI * 2);
      context.fill();
      const spec = context.createRadialGradient(
        cx - core * 0.4,
        cy - core * 0.45,
        0,
        cx - core * 0.3,
        cy - core * 0.35,
        core * 0.45,
      );
      spec.addColorStop(0, "rgba(255,255,255,0.9)");
      spec.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = spec;
      context.fill();
      context.globalAlpha = dark ? 0.35 : 0.5;
      context.strokeStyle = dark ? "rgba(255,255,255,0.8)" : "rgba(90,90,90,0.8)";
      context.lineWidth = 1;
      context.stroke();
      context.strokeStyle = ink;
      context.fillStyle = ink;
      projected.current = hits;
      context.globalAlpha = 1;
    };
    draw.current = paint;

    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      view.current.yaw += dt * 0.00006 * (1 + levelRef.current * 3);
      paint();
      frame = requestAnimationFrame(tick);
    };
    const resize = new ResizeObserver(() => paint());
    resize.observe(canvas);
    if (reducedMotion) paint();
    else frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
    };
  }, [graph, accent, reducedMotion, selectedId]);

  useEffect(() => {
    if (reducedMotion) draw.current();
  }, [level, hover, reducedMotion]);

  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const pinch = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);

  const setZoom = (zoom: number) => {
    view.current.zoom = Math.min(4, Math.max(0.6, zoom));
    setZoomShown(view.current.zoom);
    draw.current();
  };

  const hit = (x: number, y: number) =>
    projected.current
      .filter((h) => h.node.kind !== "core" && Math.hypot(h.x - x, h.y - y) <= h.r)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];

  const local = (event: React.PointerEvent | React.WheelEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const detailNodes = graph.nodes.filter((n) => n.kind !== "core");

  return (
    <div
      className={cn(
        "absolute inset-0 transition-opacity duration-700",
        dimmed ? "opacity-25" : "opacity-100",
      )}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`JARVIS graph with ${detailNodes.length} items`}
        className="h-full w-full touch-none text-foreground"
        onPointerMove={(event) => {
          const p = local(event);
          pointer.current = { ...p, inside: true };
          if (pinch.current.has(event.pointerId)) pinch.current.set(event.pointerId, p);
          if (pinch.current.size === 2 && pinchStart.current) {
            const [a, b] = [...pinch.current.values()];
            setZoom(
              pinchStart.current.zoom *
                (Math.hypot(a!.x - b!.x, a!.y - b!.y) / pinchStart.current.distance),
            );
            return;
          }
          if (drag.current) {
            const dx = p.x - drag.current.x;
            const dy = p.y - drag.current.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
            view.current.panX += dx;
            view.current.panY += dy;
            drag.current.x = p.x;
            drag.current.y = p.y;
            draw.current();
            return;
          }
          const found = hit(p.x, p.y);
          setHover(found ? { node: found.node, x: found.x, y: found.y } : null);
          if (reducedMotion) draw.current();
        }}
        onPointerLeave={() => {
          pointer.current.inside = false;
          setHover(null);
        }}
        onPointerDown={(event) => {
          const p = local(event);
          pinch.current.set(event.pointerId, p);
          if (pinch.current.size === 2) {
            const [a, b] = [...pinch.current.values()];
            pinchStart.current = {
              distance: Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1,
              zoom: view.current.zoom,
            };
            drag.current = null;
          } else {
            drag.current = { ...p, moved: false };
          }
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={(event) => {
          pinch.current.delete(event.pointerId);
          if (pinch.current.size < 2) pinchStart.current = null;
          const d = drag.current;
          drag.current = null;
          if (d && !d.moved) {
            const found = hit(d.x, d.y);
            if (found) onSelect(found.node);
          }
        }}
        onWheel={(event) => setZoom(view.current.zoom * (event.deltaY < 0 ? 1.1 : 0.9))}
        onDoubleClick={() => onFocus?.()}
      />
      {hover ? (
        <div
          className="pointer-events-none absolute rounded-md border border-border/60 bg-popover px-2 py-1 text-xs text-popover-foreground"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          {hover.node.label}
        </div>
      ) : null}
      <div
        className={cn(
          "absolute bottom-24 right-3 flex flex-col gap-1 transition-opacity duration-500 md:bottom-4",
          controlsHidden && "pointer-events-none opacity-0",
        )}
      >
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => setZoom(view.current.zoom * 1.25)}
          className="grid h-8 w-8 place-items-center rounded-md border border-border/60 bg-background/70 text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => setZoom(view.current.zoom * 0.8)}
          className="grid h-8 w-8 place-items-center rounded-md border border-border/60 bg-background/70 text-muted-foreground hover:text-foreground"
        >
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <span className="sr-only" aria-live="polite">
          {zoomShown >= DETAIL_ZOOM ? "Showing individual items" : "Showing categories"}
        </span>
      </div>
      <ul aria-label="Graph items" className="absolute left-3 top-16 flex flex-col gap-1">
        {detailNodes.map((node) => (
          <li key={node.id}>
            <button
              type="button"
              className="sr-only rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground focus:not-sr-only"
              onClick={() => onSelect(node)}
            >
              {node.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
