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
      <div
        className="inline-flex rounded-full border border-border p-0.5"
        role="group"
        aria-label="Answer quality"
      >
        {(["standard", "high"] as const).map((level) => (
          <button
            key={level}
            type="button"
            aria-pressed={value === level}
            disabled={disabled}
            className={
              value === level
                ? "h-7 rounded-full bg-foreground px-3 text-background transition-colors duration-150 disabled:opacity-40"
                : "h-7 rounded-full px-3 transition-colors duration-150 hover:text-foreground disabled:opacity-40"
            }
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
        <HighConfirm
          label="Enable High"
          onConfirm={() => {
            setAsking(false);
            onChange("high");
          }}
          onCancel={() => setAsking(false)}
        />
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

/** The one acknowledgement High needs before it is used: its warning, then the person's own yes. */
export function HighConfirm({
  label,
  onConfirm,
  onCancel,
}: {
  label: string;
  onConfirm(): void;
  onCancel(): void;
}) {
  return (
    <div role="alert" className="mt-2 space-y-2">
      <p>{HIGH_USAGE_WARNING} Availability must be verified before anything is sent.</p>
      <button
        type="button"
        className="h-7 rounded-full border border-border px-3"
        onClick={onConfirm}
      >
        {label}
      </button>{" "}
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
