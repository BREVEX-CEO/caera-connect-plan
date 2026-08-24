import { Link } from "@tanstack/react-router";
import { ArrowLeft, MonitorCog, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The demo's two rooms, and the ways out.
 *
 * Control + Work is a NAVIGATION ENTRY rather than a mode switch inside Chat,
 * and that is a safety decision rather than a layout one. A toggle inside one
 * screen means a sentence can change what it does without the user having gone
 * anywhere — and the difference between these two rooms is whether typing
 * something moves the mouse. Moving between them should feel like moving,
 * because it is.
 */
export function DemoSidebarNav({ active }: { active: "chat" | "control" }) {
  return (
    <div className="grid gap-1">
      <Link
        to="/demo/settings"
        preload="render"
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Settings2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Settings
      </Link>
      <Link
        to="/"
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Leave the demo
      </Link>
    </div>
  );
}

/** The action room belongs beside the conversation, not in the utility footer. */
export function DemoControlNav({ active }: { active: "chat" | "control" }) {
  return (
    <Link
      to={active === "control" ? "/demo/ocade" : "/demo/control"}
      className={cn(
        "ocade-depth ocade-depth-lift depth-raised flex items-center justify-between gap-3 rounded-xl border px-3 py-3 text-[13px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active === "control"
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-border/70 bg-card/50 text-foreground hover:border-primary/35 hover:bg-primary/5",
      )}
      aria-current={active === "control" ? "page" : undefined}
    >
      <span className="flex items-center gap-2">
        <MonitorCog className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span>
          <span className="block font-medium">OCADE Control + Work</span>
          <span className="mt-0.5 block text-[10.5px] text-muted-foreground">
            {active === "control" ? "Return to normal chat" : "Act on this device"}
          </span>
        </span>
      </span>
      <span aria-hidden className="text-primary">
        →
      </span>
    </Link>
  );
}
