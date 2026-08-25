import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  pullModel,
  verifyInstalled,
  removeModel,
  activateModel,
  checkDisk,
  type PullProgress,
} from "@/lib/local/model-lifecycle";
import { streamLocalChat, DEFAULT_LOCAL_BRIDGE_URL } from "@/lib/ocade-local";
import { useLocalEngine } from "@/lib/use-local-engine";
import { presentOcadeEngine } from "@/lib/ocade-model-presentation";

/**
 * Production owner for the local-model lifecycle (P05).
 *
 * Runtime model ids stay internal. A customer chooses an OCADE capability,
 * while the local bridge still receives the exact verified runtime id it needs.
 */
const SUGGESTED = [
  { id: "smollm2:135m", approxBytes: 271_000_000 },
  { id: "qwen2.5:0.5b", approxBytes: 398_000_000 },
  { id: "qwen2.5-coder:1.5b", approxBytes: 986_000_000 },
] as const;

const gb = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.round(b / 1e6)} MB`);

type Phase = "idle" | "downloading" | "verifying" | "activating" | "removing";

export function LocalModelLifecyclePanel({
  bridgeUrl = DEFAULT_LOCAL_BRIDGE_URL,
}: {
  bridgeUrl?: string;
}) {
  const engine = useLocalEngine(bridgeUrl);
  const [phase, setPhase] = useState<Phase>("idle");
  const [target, setTarget] = useState<string>(SUGGESTED[0].id);
  const [progress, setProgress] = useState<PullProgress | null>(null);
  const [controller, setController] = useState<AbortController | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const say = useCallback((line: string) => setLog((l) => [line, ...l].slice(0, 8)), []);

  const install = useCallback(async () => {
    const suggestion = SUGGESTED.find((s) => s.id === target);
    const presentation = presentOcadeEngine(target);
    const ac = new AbortController();
    setController(ac);
    setPhase("downloading");
    setProgress(null);
    say(`Downloading ${presentation.label}…`);

    const pulled = await pullModel(bridgeUrl, target, {
      signal: ac.signal,
      expectedBytes: suggestion?.approxBytes,
      onProgress: setProgress,
    });
    setController(null);

    if (!pulled.ok) {
      setPhase("idle");
      if (pulled.failure === "cancelled") {
        say(pulled.reason);
        toast.info(pulled.reason);
      } else {
        say(pulled.reason);
        toast.error(pulled.reason);
      }
      return;
    }

    setPhase("verifying");
    say("Checking the download…");
    const verified = await verifyInstalled(bridgeUrl, target);
    if (!verified.ok) {
      setPhase("idle");
      say(verified.reason);
      toast.error(verified.reason);
      return;
    }
    say(verified.digestVerified ? "Installed and verified." : "Installed. Integrity proof is unavailable from this runtime.");

    setPhase("activating");
    say("Testing OCADE Local Intelligence…");
    const activated = await activateModel(target, {
      runInference: async (id, prompt) => {
        let text = "";
        const r = await streamLocalChat(bridgeUrl, id, [{ role: "user", content: prompt }], {
          onToken: (t) => (text += t),
        });
        return { ok: r.ok, text };
      },
      runCancellable: async (id) => {
        const a = new AbortController();
        setTimeout(() => a.abort(), 800);
        const r = await streamLocalChat(
          bridgeUrl,
          id,
          [{ role: "user", content: "Count slowly from 1 to 900, one per line." }],
          { onToken: () => {}, signal: a.signal },
        );
        return { cancelled: r.ok === false && r.reason === "cancelled" };
      },
    });
    setPhase("idle");

    if (!activated.ok) {
      say(activated.reason);
      toast.error(activated.reason);
      return;
    }
    say("Ready.");
    toast.success(`${presentation.label} is ready.`);
    engine.refresh(true);
  }, [bridgeUrl, target, say, engine]);

  const remove = useCallback(
    async (modelId: string) => {
      const presentation = presentOcadeEngine(modelId);
      setPhase("removing");
      const r = await removeModel(bridgeUrl, modelId);
      setPhase("idle");
      if (!r.ok) {
        say(r.reason);
        toast.error(r.reason);
        return;
      }
      say(`${presentation.label} removed.`);
      toast.success(`${presentation.label} removed.`);
      engine.refresh(true);
    },
    [bridgeUrl, say, engine],
  );

  const busy = phase !== "idle";
  const suggestion = SUGGESTED.find((s) => s.id === target);
  const selectedPresentation = presentOcadeEngine(target);

  return (
    <section className="rounded-lg border border-border p-4" data-testid="local-model-lifecycle">
      <h3 className="text-sm font-medium">OCADE Local Intelligence</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Choose the level you want. OCADE handles the underlying runtime and keeps generation on this device.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          className="rounded border border-border bg-background px-2 py-1 text-xs"
          value={target}
          disabled={busy}
          onChange={(e) => setTarget(e.target.value)}
          aria-label="OCADE local intelligence level"
        >
          {SUGGESTED.map((s) => {
            const presentation = presentOcadeEngine(s.id);
            return (
              <option key={s.id} value={s.id}>
                {presentation.label} · {gb(s.approxBytes)}
              </option>
            );
          })}
        </select>

        <button
          type="button"
          className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50"
          onClick={() => void install()}
          disabled={busy}
        >
          {phase === "downloading"
            ? "Downloading…"
            : phase === "verifying"
              ? "Checking…"
              : phase === "activating"
                ? "Testing…"
                : "Install"}
        </button>

        {controller && (
          <button
            type="button"
            className="rounded border border-border px-3 py-1 text-xs"
            onClick={() => controller.abort()}
          >
            Cancel
          </button>
        )}
      </div>

      {suggestion ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {selectedPresentation.description} Download size is about {gb(suggestion.approxBytes)}.
        </p>
      ) : null}

      {progress && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress.percent ?? 0}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {progress.status}
            {progress.totalBytes > 0 && ` · ${Math.round(progress.percent ?? 0)}%`}
          </p>
        </div>
      )}

      {engine.models.length > 0 && (
        <ul className="mt-4 space-y-1">
          {engine.models.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 text-xs">
              <span>{presentOcadeEngine(m.id).label}</span>
              <button
                type="button"
                className="rounded border border-border px-2 py-0.5 disabled:opacity-50"
                onClick={() => void remove(m.id)}
                disabled={busy}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {log.length > 0 && (
        <ul className="mt-3 space-y-0.5 text-xs text-muted-foreground">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Exported for the panel's tests — the disclosure must match the check. */
const disclosedInstallBytes = (approxBytes: number) => checkDisk(approxBytes, Number.NaN).needBytes;
void disclosedInstallBytes;
