import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * THE TWO SHAPES EVERY SETTINGS SCREEN IS MADE OF.
 *
 * A row and a button, defined once. Four sections had copied the same
 * `flex items-start justify-between … border-b` row between them, which is how
 * one screen ends up with 13px descriptions and the next with 14px ones.
 */

export function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border/50 py-4 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{label}</p>
        {description ? (
          <div className="mt-1 text-[13px] leading-5 text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}

export function Action({
  label,
  onClick,
  busy,
  destructive,
}: {
  label: string;
  onClick: () => void | Promise<void>;
  busy?: boolean;
  /** Only for something that cannot be undone. */
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void onClick()}
      className={cn(
        "h-8 rounded-md border px-3 text-sm transition-colors disabled:opacity-50",
        destructive
          ? "border-destructive/50 text-destructive hover:bg-destructive/10"
          : "border-border text-foreground hover:bg-accent",
      )}
    >
      {label}
    </button>
  );
}

/** The quiet second half of a confirmation: "actually do it" beside "no". */
export function Confirm({
  label,
  onConfirm,
  onCancel,
  busy,
}: {
  label: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Action label={label} onClick={onConfirm} busy={busy} destructive />
      <button
        type="button"
        onClick={onCancel}
        className="h-8 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        Keep
      </button>
    </div>
  );
}
