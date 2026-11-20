import { useState } from "react";
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
}: {
  deviceId: string;
  platform: string | null;
  engines: unknown;
}) {
  const reported = Array.isArray(engines) ? (engines as string[]) : null;
  const key = (engine: string) => `ocade.guide.${deviceId}.${engine}`;
  const [closed, setClosed] = useState<Set<string>>(
    () =>
      new Set(
        typeof window === "undefined"
          ? []
          : NEEDS.map((n) => n.engine).filter((e) => window.localStorage.getItem(key(e)) === "1"),
      ),
  );
  // Only a Mac that has reported its engines; an older companion that reports none is not guessed.
  if (!/mac|darwin/i.test(platform ?? "") || reported === null || reported.length === 0)
    return null;
  const missing = NEEDS.filter(
    (need) => !reported.includes(need.engine) && !closed.has(need.engine),
  );
  if (!missing.length) return null;
  return (
    <div className="space-y-2">
      {missing.map((need) => (
        <div
          key={need.engine}
          role="region"
          aria-label={`Allow ${need.name}`}
          className="relative overflow-hidden rounded-xl border border-white/20 bg-gradient-to-br from-sky-500/15 via-fuchsia-500/10 to-amber-400/15 p-3 text-xs backdrop-blur"
        >
          <button
            type="button"
            aria-label={`Close the ${need.name} guide`}
            onClick={() => {
              window.localStorage.setItem(key(need.engine), "1");
              setClosed(new Set([...closed, need.engine]));
            }}
            className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-md hover:bg-accent"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
          <p className="pr-8 font-medium">
            Not allowed yet on this Mac: {need.name}, {need.why}.
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
          <p className="mt-2 text-muted-foreground">
            OCADE shows this until the Mac itself reports the permission, which it checks every few
            minutes while JARVIS runs. Nothing here can turn it on for you.
          </p>
        </div>
      ))}
    </div>
  );
}
