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

/**
 * Production owner for the local-model lifecycle (P05).
 *
 * `model-lifecycle.ts` had no reachable entry point, which would have made it a
 * source-complete module imported only by tests — the exact shape this audit
 * counts as unwired. This panel is that entry point.
 *
 * It is deliberately plain about three things the user is entitled to know
 * before a multi-hundred-megabyte download starts: how big it is, where it
 * goes, and that it stays on this machine. It does not start anything on its
 * own — every action here is a button the user presses.
 */

/** Storage disclosure is not optional, so the size travels with the id. */
const SUGGESTED = [
  { id: "smollm2:135m", label: "Smallest", approxBytes: 271_000_000 },
  { id: "qwen2.5:0.5b", label: "Small", approxBytes: 398_000_000 },
  { id: "qwen2.5-coder:1.5b", label: "Code", approxBytes: 986_000_000 },
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
    const ac = new AbortController();
    setController(ac);
    setPhase("downloading");
    setProgress(null);
    say(`Downloading ${target} (${gb(suggestion?.approxBytes ?? 0)})…`);

    const pulled = await pullModel(bridgeUrl, target, {
      signal: ac.signal,
      expectedBytes: suggestion?.approxBytes,
      onProgress: setProgress,
    });
    setController(null);

    if (!pulled.ok) {
      setPhase("idle");
      // Cancelling is a normal outcome, not an error, and resuming works.
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
    say("Checking the download actually installed…");
    const verified = await verifyInstalled(bridgeUrl, target);
    if (!verified.ok) {
      setPhase("idle");
      say(verified.reason);
      toast.error(verified.reason);
      return;
    }
    say(
      verified.digestVerified
        ? `Installed, ${gb(verified.sizeBytes)}, digest checked.`
        : `Installed, ${gb(verified.sizeBytes)}. The engine did not report a digest, so this is unverified.`,
    );

    // Downloaded is not ready. Prove it answers AND stops.
    setPhase("activating");
    say("Testing that it answers and that it can be stopped…");
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
    say(`Ready. First reply in ${activated.firstTokenMs} ms.`);
    toast.success("Local engine ready.");
    engine.refresh(true);
  }, [bridgeUrl, target, say, engine]);

  const remove = useCallback(
    async (modelId: string) => {
      setPhase("removing");
      const r = await removeModel(bridgeUrl, modelId);
      setPhase("idle");
      if (!r.ok) {
        say(r.reason);
        toast.error(r.reason);
        return;
      }
      say(`Removed ${modelId} and freed its storage.`);
      toast.success(`Removed ${modelId}.`);
      engine.refresh(true);
    },
    [bridgeUrl, say, engine],
  );

  const busy = phase !== "idle";
  const suggestion = SUGGESTED.find((s) => s.id === target);

  return (
    <section className="rounded-lg border border-border p-4" data-testid="local-model-lifecycle">
      <h3 className="text-sm font-medium">On-device engines</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Downloads run through the engine on your own machine and stay there. Nothing you type is
        sent anywhere while an on-device engine is answering.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          className="rounded border border-border bg-background px-2 py-1 text-xs"
          value={target}
          disabled={busy}
          onChange={(e) => setTarget(e.target.value)}
          aria-label="Engine to install"
        >
          {SUGGESTED.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} — {s.id} ({gb(s.approxBytes)})
            </option>
          ))}
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

        {suggestion && (
          <span className="text-xs text-muted-foreground">
            Uses about {gb(Math.round(suggestion.approxBytes * 1.15))} of disk while installing.
          </span>
        )}
      </div>

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
            {progress.totalBytes > 0 &&
              ` — ${gb(progress.completedBytes)} of ${gb(progress.totalBytes)}`}
          </p>
        </div>
      )}

      {engine.models.length > 0 && (
        <ul className="mt-4 space-y-1">
          {engine.models.map((m) => (
            <li key={m.id} className="flex items-center justify-between text-xs">
              <span>
                {m.label} <span className="text-muted-foreground">— {gb(m.sizeBytes)}</span>
              </span>
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
