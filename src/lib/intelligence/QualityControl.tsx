import { useEffect, useState } from "react";
import { toast } from "sonner";
import { HIGH_USAGE_WARNING, HIGH_WARNING_INTERVAL_MS, type IntelligenceQuality } from "./quality";

export function QualityControl({
  value,
  onChange,
  disabled = false,
}: {
  value: IntelligenceQuality;
  onChange(value: IntelligenceQuality): void;
  disabled?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (value !== "high") return;
    const warning = () => toast.warning(HIGH_USAGE_WARNING, { duration: 15_000, id: "high-usage" });
    const timer = window.setInterval(warning, HIGH_WARNING_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      toast.dismiss("high-usage");
    };
  }, [value]);
  return (
    <div className="my-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-2" role="group" aria-label="Answer quality">
        {(["standard", "high"] as const).map((level) => (
          <button
            key={level}
            type="button"
            aria-pressed={value === level}
            disabled={disabled}
            className="rounded border border-border px-2 py-1 disabled:opacity-40"
            onClick={() => {
              if (level === "high" && value !== "high") setAsking(true);
              else {
                setAsking(false);
                onChange(level);
              }
            }}
          >
            {level === "high" ? "High" : "Standard"}
          </button>
        ))}
      </div>
      {asking && !disabled ? (
        <div role="alert" className="mt-2 space-y-2">
          <p>{HIGH_USAGE_WARNING} Availability must be verified before anything is sent.</p>
          <button
            type="button"
            className="rounded border border-border px-2 py-1"
            onClick={() => {
              setAsking(false);
              onChange("high");
            }}
          >
            Enable High
          </button>{" "}
          <button type="button" onClick={() => setAsking(false)}>
            Cancel
          </button>
        </div>
      ) : null}
      {value === "high" ? (
        <p role="status" className="mt-2">
          {HIGH_USAGE_WARNING}
          {disabled ? " This task keeps its selected mode until it ends." : ""}
        </p>
      ) : null}
    </div>
  );
}
