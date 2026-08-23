import { useState, type ReactNode } from "react";

export function OcadeBanner({ title, children, kind = "info", action, dismissible = false }: { title: string; children: ReactNode; kind?: "info" | "success" | "warning" | "error"; action?: { label: string; onClick: () => void }; dismissible?: boolean }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  const tone = { info: "border-primary/35 bg-primary/8", success: "border-[color:var(--state-success)]/40 bg-[color:var(--state-success)]/10", warning: "border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10", error: "border-destructive/40 bg-destructive/10" }[kind];
  return <aside role={kind === "error" ? "alert" : "status"} className={`rounded-xl border p-4 ${tone}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium text-foreground">{title}</p><div className="mt-1 text-sm text-muted-foreground">{children}</div></div><div className="flex gap-2">{action ? <button type="button" onClick={action.onClick} className="min-h-9 rounded-md border border-border/70 px-3 text-xs">{action.label}</button> : null}{dismissible ? <button type="button" aria-label={`Dismiss ${title}`} onClick={() => setVisible(false)} className="min-h-9 rounded-md border border-border/70 px-3 text-xs">Dismiss</button> : null}</div></div></aside>;
}
