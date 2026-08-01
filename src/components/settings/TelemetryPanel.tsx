import { useCallback, useMemo, useState } from "react";
import { Radio } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import {
  TelemetryQueue,
  newInstallId,
  containsOnlyAllowedFields,
  ALLOWED_FIELDS,
  type TelemetryConsent,
} from "@/lib/telemetry/failure-telemetry";

/**
 * Production owner for opt-in failure telemetry (HWE-38).
 *
 * The panel shows the ACTUAL fields that would be transmitted, from the real
 * queue, rather than describing them in prose. A privacy claim a user cannot
 * check is a privacy claim they have to take on faith, and this is the one
 * place where that is least acceptable.
 *
 * Consent starts off and there is no pre-ticked box. Withdrawing it discards
 * anything already collected — otherwise "off" would mean "stops collecting
 * more" while a queue of reports waited on disk.
 */

const CHOICES: Array<{ value: TelemetryConsent; label: string; blurb: string }> = [
  { value: "none", label: "Send nothing", blurb: "Nothing is collected. This is the default." },
  {
    value: "failures_only",
    label: "Failures only",
    blurb: "Which applications and routes OCADE fails on. No file names, titles or content.",
  },
  {
    value: "failures_and_performance",
    label: "Failures and timing",
    blurb: "Adds how long actions took, so slow paths can be found.",
  },
];

export function TelemetryPanel() {
  const env = useMemo(
    () => ({
      osFamily: typeof navigator === "undefined" ? "unknown" : navigator.platform || "unknown",
      osVersion: "unknown",
      ocadeVersion: "0.1.0",
      installId: newInstallId(),
    }),
    [],
  );
  const queue = useMemo(() => new TelemetryQueue(env), [env]);
  const [consent, setConsentState] = useState<TelemetryConsent>("none");
  const [pending, setPending] = useState(() => queue.pending());

  const choose = useCallback(
    (next: TelemetryConsent) => {
      queue.setConsent(next);
      setConsentState(next);
      setPending(queue.pending());
    },
    [queue],
  );

  /** Record a sample failure so the user can read a real report. */
  const sample = useCallback(() => {
    queue.record({
      kind: "control_route_failed",
      failureCode: "stale_target",
      route: "accessibility",
      appId: "com.example.editor",
      appVersion: "4.1.0",
      durationMs: 812,
      // Deliberately included to demonstrate that it is NOT transmitted.
      windowTitle: "Quarterly results FINAL.xlsx",
    });
    setPending(queue.pending());
  }, [queue]);

  return (
    <GlassPanel className="p-4" data-testid="telemetry-panel">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Radio className="h-4 w-4" aria-hidden />
        Failure reporting
      </h3>
      <p className="text-xs text-muted-foreground">
        OCADE collects nothing unless you turn this on. When it is on, only the fields listed below
        are sent — never file names, window titles, clipboard contents or anything you typed.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {CHOICES.map((c) => (
          <label key={c.value} className="flex items-start gap-2 text-xs">
            <input
              type="radio"
              name="telemetry-consent"
              className="mt-0.5"
              checked={consent === c.value}
              onChange={() => choose(c.value)}
            />
            <span>
              <span className="font-medium">{c.label}</span>
              <br />
              <span className="text-muted-foreground">{c.blurb}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={sample} disabled={consent === "none"}>
          Show me a real report
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            queue.clear();
            setPending(queue.pending());
          }}
          disabled={pending.length === 0}
        >
          Delete collected reports
        </Button>
        <span className="text-xs text-muted-foreground">
          {pending.length} report{pending.length === 1 ? "" : "s"} waiting
        </span>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-muted-foreground">
          Every field that can be sent ({ALLOWED_FIELDS.length})
        </summary>
        <ul className="mt-1.5 flex flex-wrap gap-1">
          {ALLOWED_FIELDS.map((f) => (
            <li
              key={f}
              className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {f}
            </li>
          ))}
        </ul>
      </details>

      {pending.length > 0 && (
        <div className="mt-3 rounded border border-border/70 p-2">
          <p className="text-xs font-medium">Exactly what would be sent</p>
          <pre className="mt-1 overflow-x-auto text-[10px] text-muted-foreground">
            {JSON.stringify(pending[0], null, 2)}
          </pre>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {containsOnlyAllowedFields(pending[0]).ok
              ? "Checked: no field outside the list above."
              : "A field outside the list was found — this is a defect."}
          </p>
        </div>
      )}
    </GlassPanel>
  );
}
