import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

/**
 * ANIMATED PERMISSION GUIDE (plan 27.2.5 R12-05): the macOS permissions only the person can grant,
 * from what the computer itself reports (its `desktop` and `capture` engines). The guide shows the
 * real steps in System Settings; it never claims a permission it has not seen, and the companion
 * shows macOS's own prompt when it starts. Closing it with × grants, denies and stops nothing.
 * Windows needs neither permission, so nothing is shown there.
 */
const NEEDS = [
  {
    engine: "desktop",
    name: "Accessibility",
    why: "so JARVIS can read and press controls in your apps",
    pane: "Accessibility",
  },
  {
    engine: "capture",
    name: "Screen Recording",
    why: "so JARVIS can see the app windows it works in (it can still press controls without it)",
    pane: "Screen & System Audio Recording",
  },
] as const;

export function PermissionGuide({
  deviceId,
  platform,
  engines,
  onRefresh,
}: {
  deviceId: string;
  platform: string | null;
  engines: unknown;
  onRefresh: () => Promise<unknown>;
}) {
  const reported = Array.isArray(engines) ? engines : null;
  const [closed, setClosed] = useState<string[]>([]);
  const [check, setCheck] = useState<"idle" | "pending" | "read" | "failed">("idle");
  const guides = useRef<HTMLDivElement>(null);
  const reopen = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef<"restart" | "guide" | null>(null);

  useEffect(() => {
    try {
      setClosed(
        NEEDS.filter(
          ({ engine }) => localStorage.getItem(`ocade.guide.${deviceId}.${engine}`) === "1",
        ).map(({ engine }) => engine),
      );
    } catch {
      // The guide also works when the browser disables this storage.
    }
  }, [deviceId]);
  useEffect(() => {
    if (restoreFocus.current === "restart") {
      reopen.current?.focus();
    } else if (restoreFocus.current === "guide") {
      guides.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }
    restoreFocus.current = null;
  }, [closed]);
  // Only a Mac that has reported its engines; an older companion that reports none is not guessed.
  if (!/mac|darwin/i.test(platform ?? "") || reported === null || reported.length === 0)
    return null;
  const missing = NEEDS.filter((need) => !reported.includes(need.engine));
  if (!missing.length)
    return check === "read" ? (
      <p role="status" className="text-xs text-muted-foreground">
        This Mac reports that Accessibility and Screen Recording are enabled.
      </p>
    ) : null;
  const hide = (engine: string) => {
    try {
      localStorage.setItem(`ocade.guide.${deviceId}.${engine}`, "1");
    } catch {
      // Dismiss for this visit.
    }
    restoreFocus.current = "restart";
    setClosed((current) => [...current, engine]);
  };
  return (
    <div ref={guides} className="space-y-2">
      {missing.some((need) => closed.includes(need.engine)) ? (
        <button
          type="button"
          ref={reopen}
          onClick={() => {
            try {
              for (const { engine } of missing) {
                localStorage.removeItem(`ocade.guide.${deviceId}.${engine}`);
              }
            } catch {
              // Reopen for this visit.
            }
            restoreFocus.current = "guide";
            setClosed([]);
          }}
          className="min-h-11 rounded-lg border border-border px-3 text-xs hover:bg-accent"
        >
          Show Mac permission guide
        </button>
      ) : null}
      {missing
        .filter((need) => !closed.includes(need.engine))
        .map((need) => (
          <div
            key={need.engine}
            role="region"
            aria-label={`Allow ${need.name}`}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                hide(need.engine);
              }
            }}
            className="relative overflow-hidden rounded-xl border border-white/20 bg-gradient-to-br from-sky-500/15 via-fuchsia-500/10 to-amber-400/15 p-3 text-xs backdrop-blur"
          >
            <button
              type="button"
              aria-label={`Close the ${need.name} guide`}
              onClick={() => hide(need.engine)}
              className="absolute right-1.5 top-1.5 grid size-11 place-items-center rounded-md hover:bg-accent"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
            <p className="pr-12 font-medium">
              Allow {need.name} on this Mac {need.why}.
            </p>
            <ol className="mt-2 space-y-1">
              {[
                "On the Mac, open System Settings.",
                "Choose Privacy & Security.",
                `Open ${need.pane}.`,
                "Turn on OCADE JARVIS, then quit and reopen it if macOS asks.",
              ].map((text, index) => (
                <li
                  key={text}
                  className="ocade-guide-step flex gap-2"
                  style={{ animationDelay: `${index * 450}ms` }}
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-foreground text-[10px] text-background">
                    {index + 1}
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      {missing.some((need) => !closed.includes(need.engine)) ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            disabled={check === "pending"}
            onClick={() => {
              setCheck("pending");
              void onRefresh().then(
                () => setCheck("read"),
                () => setCheck("failed"),
              );
            }}
            className="min-h-11 rounded-lg border border-border px-3 hover:bg-accent"
          >
            Check permission report
          </button>
          <p role="status" className="text-muted-foreground">
            {check === "pending"
              ? "Checking the latest report…"
              : check === "failed"
                ? "Could not read the report. Try again."
                : check === "read"
                  ? "Permissions still unconfirmed. Restart OCADE JARVIS on your Mac after granting them."
                  : "Your Mac reports its permissions when the companion starts and while it runs."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
