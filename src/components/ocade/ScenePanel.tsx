import { useState } from "react";
import { Boxes, ShieldCheck, AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { cn } from "@/lib/utils";
import { buildBox, buildSphere, validateMesh } from "@/lib/vision3d/mesh";
import { assessScene, RENDER_REALITY, type Scene } from "@/lib/vision3d/scene";
import {
  assessReconstruction,
  RECONSTRUCTION_REALITY,
  type Frame,
} from "@/lib/vision3d/reconstruction";
import { exportGltf, serialiseGltf } from "@/lib/vision3d/gltf";

/**
 * 3D work, with the distinction between "checked" and "rendered" kept visible.
 *
 * Every number here comes from running the real geometry code. The panel is
 * deliberately built so that the honest limits — no renderer, no solver —
 * render alongside the successes rather than after them.
 */

type Demo = "lit" | "unlit" | "static_video";

/** A locked-off shot: no parallax, so no reconstruction is possible. */
const STATIC_FOOTAGE: Frame[] = Array.from({ length: 24 }, (_, i) => ({
  index: i,
  timestamp: i * 0.1,
  position: [0, 0, 0],
  sharpness: 500,
  focalLengthMm: 24,
}));

function demoScene(lit: boolean): Scene | null {
  const box = buildBox(1, 1, 1);
  const sphere = buildSphere(0.6, 24, 12);
  if (!box.ok || !sphere.ok) return null;

  return {
    name: "sample-scene",
    objects: [
      { name: "Cube", mesh: box.data, material: "Plastic" },
      { name: "Ball", mesh: sphere.data, material: "Metal" },
    ],
    materials: [
      { name: "Plastic", baseColor: [0.6, 0.2, 0.2], metallic: 0, roughness: 0.5 },
      { name: "Metal", baseColor: [0.9, 0.9, 0.9], metallic: 1, roughness: 0.25 },
    ],
    lights: lit ? [{ name: "Key", kind: "sun", intensity: 4, color: [1, 1, 1] }] : [],
  };
}

export function ScenePanel() {
  const [demo, setDemo] = useState<Demo | null>(null);
  const [exported, setExported] = useState<string | null>(null);

  const box = buildBox(1, 1, 1);
  const geometry = box.ok ? validateMesh(box.data) : null;

  const scene = demoScene(demo !== "unlit");
  const assessment = scene ? assessScene(scene) : null;
  const footage = assessReconstruction(STATIC_FOOTAGE);

  return (
    <GlassPanel className="p-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Boxes className="h-4 w-4" aria-hidden /> 3D that checks itself
      </h3>
      <p className="mb-2 text-xs text-muted-foreground">
        Geometry is generated here and validated against properties real solids have — watertight,
        wound outward, Euler characteristic 2. A mesh that fails is refused, not shipped.
      </p>

      {geometry?.ok ? (
        <p className="mb-3 rounded-lg border border-border/60 bg-secondary/25 p-2 text-[11px] text-muted-foreground">
          Unit cube, generated and checked just now: {geometry.evidence}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={demo === "lit" ? "default" : "ghost"}
          className="h-8"
          onClick={() => setDemo("lit")}
        >
          Check a scene
        </Button>
        <Button
          size="sm"
          variant={demo === "unlit" ? "default" : "ghost"}
          className="h-8"
          onClick={() => setDemo("unlit")}
        >
          Check it with no lights
        </Button>
        <Button
          size="sm"
          variant={demo === "static_video" ? "default" : "ghost"}
          className="h-8"
          onClick={() => setDemo("static_video")}
        >
          3D from a static video
        </Button>
      </div>

      {(demo === "lit" || demo === "unlit") && assessment ? (
        <div
          role="status"
          className={cn(
            "mt-3 rounded-lg border p-3 text-xs",
            assessment.ok
              ? "border-[color:var(--state-success-line-strong)] bg-[color:var(--state-success-surface)]"
              : "border-[color:var(--state-warning-line-strong)] bg-[color:var(--state-warning-surface)]",
          )}
        >
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            {assessment.ok ? (
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            )}
            {assessment.ok ? "Ready to render" : "Won't render usefully"}
          </p>
          <p className="mt-1 text-muted-foreground">
            {assessment.ok ? assessment.evidence : assessment.reason}
          </p>
          {assessment.ok && assessment.data.warnings.length > 0 ? (
            <ul className="mt-1.5 flex flex-col gap-1">
              {assessment.data.warnings.map((w) => (
                <li key={w} className="text-[11px] text-muted-foreground">
                  {w}
                </li>
              ))}
            </ul>
          ) : null}
          {/* "Checked" and "rendered" must never blur together. */}
          {assessment.ok ? (
            <p className="mt-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
              {RENDER_REALITY}
            </p>
          ) : null}
        </div>
      ) : null}

      {/*
        Export is offered only once the scene has passed its checks. Handing
        someone a file built from geometry OCADE just refused would undo the
        point of refusing.
      */}
      {demo === "lit" && assessment?.ok && scene ? (
        <div className="mt-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-8"
            onClick={() => {
              const file = exportGltf(scene);
              if (!file.ok) {
                setExported(file.reason);
                return;
              }
              // The document is serialised here, so what's reported is the size
              // of the exact payload offered to the browser, not an estimate.
              const text = serialiseGltf(file.data);
              const blob = new Blob([text], { type: "model/gltf+json;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = "ocade-scene.gltf";
              anchor.click();
              URL.revokeObjectURL(url);
              setExported(
                `${file.evidence} ${(blob.size / 1024).toFixed(1)} kB glTF download requested.`,
              );
            }}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Export as glTF
          </Button>
          {exported ? (
            <p role="status" className="mt-1.5 text-[11px] text-muted-foreground">
              {exported}
            </p>
          ) : null}
        </div>
      ) : null}

      {demo === "static_video" ? (
        <div
          role="status"
          className={cn(
            "mt-3 rounded-lg border p-3 text-xs",
            footage.ok
              ? "border-[color:var(--state-success-line-strong)] bg-[color:var(--state-success-surface)]"
              : "border-[color:var(--state-warning-line-strong)] bg-[color:var(--state-warning-surface)]",
          )}
        >
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            {footage.ok ? (
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            )}
            {footage.ok ? "Worth attempting" : "OCADE won't build a model from this"}
          </p>
          <p className="mt-1 text-muted-foreground">
            {footage.ok ? footage.evidence : footage.reason}
          </p>
          {!footage.ok ? (
            <p className="mt-1.5 border-t border-border/60 pt-1.5 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">Shoot instead: </span>
              {footage.shootInstead}
            </p>
          ) : (
            <p className="mt-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
              {RECONSTRUCTION_REALITY}
            </p>
          )}
        </div>
      ) : null}
    </GlassPanel>
  );
}
