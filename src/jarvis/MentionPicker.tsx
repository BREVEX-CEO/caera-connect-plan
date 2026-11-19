import type { MentionCandidate } from "@/lib/jarvis/mentions";

/**
 * THE @ LIST UNDER THE JARVIS COMPOSER (plan 14E.3).
 *
 * Shows the apps the selected computer reports, allowed ones first. An app that is not allowed on
 * that computer is listed as "Needs permission" and cannot be picked: a mention never grants
 * access, it only narrows a task to apps already allowed. Keyboard handling lives in the composer;
 * this renders the list and reports a pick; `use-mentions.ts` supplies the candidates.
 */
export function MentionList({
  candidates,
  active,
  loading,
  failed,
  deviceName,
  onPick,
  onHover,
  onPermissions,
}: {
  candidates: MentionCandidate[];
  active: number;
  loading: boolean;
  failed: boolean;
  deviceName: string | null;
  onPick: (candidate: MentionCandidate) => void;
  onHover: (index: number) => void;
  onPermissions: () => void;
}) {
  const empty = loading
    ? "Reading this computer's apps…"
    : failed
      ? "This computer's permissions could not be read. Try again."
      : !deviceName
        ? "Pair a computer to name its apps."
        : "No matching apps on this computer.";
  return (
    <div className="absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-xl border border-border bg-background shadow-lg">
      {deviceName ? (
        <p className="border-b border-border/60 px-3 py-1.5 text-[0.75rem] text-muted-foreground">
          Apps on {deviceName}
        </p>
      ) : null}
      {candidates.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground" role="status">
          {empty}
        </p>
      ) : (
        <ul
          id="jarvis-mentions"
          role="listbox"
          aria-label="Apps to name"
          className="max-h-64 overflow-y-auto py-1"
        >
          {candidates.map((candidate, index) => (
            <li
              key={candidate.exe}
              id={`jarvis-mention-${index}`}
              role="option"
              aria-selected={index === active}
              aria-disabled={!candidate.allowed}
              onMouseEnter={() => onHover(index)}
              onMouseDown={(event) => {
                // Keep focus in the composer.
                event.preventDefault();
                if (candidate.allowed) onPick(candidate);
                else onPermissions();
              }}
              className={
                "flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-sm " +
                (index === active ? "bg-accent" : "")
              }
            >
              <span className="min-w-0 truncate">
                <span className="text-foreground">{candidate.name}</span>{" "}
                <span className="text-muted-foreground">@{candidate.exe}</span>
              </span>
              {candidate.allowed ? null : (
                <span className="shrink-0 text-[0.75rem] text-muted-foreground">
                  Needs permission
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
