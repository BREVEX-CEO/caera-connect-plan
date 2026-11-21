import { useId } from "react";

export type ControlMode = "live" | "background";

export function ControlModePicker({
  mode,
  pending = false,
  onChange,
}: {
  mode: ControlMode;
  pending?: boolean;
  onChange: (mode: ControlMode) => void;
}) {
  const control = useId();
  const hint = `${control}-hint`;
  return (
    <div className="flex flex-wrap items-center gap-x-2 text-xs">
      <label htmlFor={control} className="font-medium">
        Control mode
      </label>
      <select
        id={control}
        value={mode}
        disabled={pending}
        aria-describedby={hint}
        onChange={(event) =>
          onChange(event.currentTarget.value === "background" ? "background" : "live")
        }
        className="min-h-11 rounded-lg border border-border bg-background px-2"
      >
        <option value="live">Live</option>
        <option value="background">Background</option>
      </select>
      <span id={hint} aria-live="polite" className="text-muted-foreground">
        {pending
          ? "Switching mode…"
          : mode === "background"
            ? "Keeps your mouse, keyboard and focus free. Switch to Live if a step needs them."
            : "JARVIS may type, click and open windows on your computer."}
      </span>
    </div>
  );
}
