import { useEffect, useRef, useState } from "react";
import { PanelLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The chat layout.
 *
 * WHY A DEDICATED SHELL. The chat screen has three jobs that fight each other:
 * a history list that wants to persist, a transcript that must scroll, and a
 * composer that must stay put. Doing that with page-level scrolling produces
 * the two defects every chat interface eventually has — a composer that drifts
 * off the bottom, and a transcript that jumps when a reply arrives. So the
 * shell owns the scroll: exactly ONE region scrolls, and it is the transcript.
 *
 * MOBILE IS A DRAWER, NOT A SQUEEZE. Below `lg` the sidebar becomes an overlay
 * with a backdrop, focus containment and Escape, because a 320 px column beside
 * a 55 px transcript serves nobody.
 */

export interface ChatShellProps {
  sidebar: React.ReactNode;
  header?: React.ReactNode;
  composer: React.ReactNode;
  children: React.ReactNode;
  /** Rendered above the transcript, full width — warnings, banners. */
  banner?: React.ReactNode;
  sidebarLabel?: string;
}

export function ChatShell({
  sidebar,
  header,
  composer,
  children,
  banner,
  sidebarLabel = "Chat history",
}: ChatShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  // Escape closes, and focus returns to the control that opened it. Losing
  // focus to the page body after closing a drawer strands keyboard users.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawerOpen(false);
        openerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    drawerRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <div className="flex h-[100dvh] min-h-0 w-full overflow-hidden bg-background">
      {/* Persistent sidebar from lg up. */}
      <aside
        aria-label={sidebarLabel}
        className="hidden w-[17.5rem] shrink-0 border-r border-border/60 bg-card/30 lg:block"
      >
        {sidebar}
      </aside>

      {/* Drawer below lg. */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close chat history"
            onClick={() => {
              setDrawerOpen(false);
              openerRef.current?.focus();
            }}
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={sidebarLabel}
            tabIndex={-1}
            className="absolute inset-y-0 left-0 flex w-[85vw] max-w-[19rem] flex-col border-r border-border/60 bg-card shadow-xl outline-none"
          >
            <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
              <span className="text-[13px] font-medium text-foreground">{sidebarLabel}</span>
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  openerRef.current?.focus();
                }}
                aria-label="Close chat history"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1">{sidebar}</div>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/60 px-3 sm:px-4">
          <button
            ref={openerRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open chat history"
            aria-expanded={drawerOpen}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">{header}</div>
        </header>

        {banner ? <div className="shrink-0 px-3 pt-3 sm:px-4">{banner}</div> : null}

        {/* The one scrolling region in the whole screen. */}
        <main className={cn("min-h-0 flex-1 overflow-y-auto")} aria-label="Conversation">
          {children}
        </main>

        <div className="shrink-0 border-t border-border/60 bg-background/80 backdrop-blur">
          {composer}
        </div>
      </div>
    </div>
  );
}
