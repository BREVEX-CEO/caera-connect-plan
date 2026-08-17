import { Link, useLocation } from "@tanstack/react-router";
import { FolderOpen, ListChecks, MessageSquare, Monitor, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/ocade", label: "Chat", icon: MessageSquare, exact: true },
  { to: "/ocade/projects", label: "Projects", icon: FolderOpen },
  { to: "/ocade/tasks", label: "Tasks", icon: ListChecks },
  { to: "/ocade/devices", label: "Devices", icon: Monitor },
  { to: "/ocade/system", label: "More", icon: SlidersHorizontal },
] as const;

/**
 * Mobile is not a squeezed desktop sidebar. This five-item rail keeps the most
 * common destinations thumb-reachable; the complete tool set remains in the
 * existing drawer and command palette. Hidden at md+ where WorkspaceShell owns
 * navigation. Safe-area padding avoids the iOS home indicator.
 */
export function OcadeMobileBottomNav() {
  const { pathname } = useLocation();
  if (!pathname.startsWith("/ocade")) return null;

  return (
    <nav
      aria-label="OCADE mobile navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/95 px-2 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-1.5 backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 gap-1">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-medium transition-colors",
                  active ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
