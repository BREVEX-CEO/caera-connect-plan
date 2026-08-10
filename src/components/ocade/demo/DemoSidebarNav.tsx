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
        to="/demo/control"
        className={cn(
          "flex items-center gap-2 rounded-lg px-2 py-2 text-[13px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active === "control"
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
        aria-current={active === "control" ? "page" : undefined}
      >
        <MonitorCog className="h-3.5 w-3.5 shrink-0" aria-hidden />
        OCADE Control + Work
      </Link>
      <Link
        to="/settings"
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
