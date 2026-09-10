import { useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Handshake } from "@/lib/native/extension-bridge";
import type { Mission } from "@/lib/work/use-mission";

/**
 * The Command Center: a collapsible inspector, and deliberately not a dashboard.
 *
 * WHAT DESIGN.md ASKS FOR, LITERALLY. "The Command Center is a collapsible
 * right inspector that can show browser/device connection, active executor,
 * permission state, current action, receipts and diagnostics. The inspector
 * should not occupy the main Cowork canvas when nothing requires it." Before
 * this, the room had the NAME and not the thing: the right column was titled
 * "OCADE Command Center" while being the conversation and the composer — the
 * primary surface, permanently open, with none of those six answers in it.
 *
 * WHY IT IS CLOSED BY DEFAULT. Every fact in here is a fact about the machine
 * rather than about the work, and a person who is watching OCADE tidy their
 * desktop does not need the executor or the withheld tool domains on screen to
 * do it. They need them at the moment something looks wrong, which is what a
 * collapsed panel with one obvious control is for.
 *
 * WHY IT READS THE MISSION RATHER THAN QUERYING. Connection, permission and
 * receipt state all already exist, decided once, in the runtime that acts on
 * them. An inspector that fetched its own copy would be a second opinion about
 * the same computer, and the two would eventually disagree — at which point the
 * panel a person opens BECAUSE something looks wrong is the one lying to them.
 */
export function CoworkCommandCenter({
  mission,
  extension,
  extensionChecking,
  onRecheckExtension,
  className,
}: {
  mission: Mission;
  /** The extension's own answer, or null when it has never replied. */
  extension: Handshake | null;
  extensionChecking: boolean;
  onRecheckExtension: () => void;
  className?: string;
}) {
  const start = mission.start;

  /*
   * WHO IS HOLDING THE KEYBOARD, in the order that decides it.
   *
   * Handover outranks everything: after Take over the user has the machine
   * even though the panel is otherwise idle. Paused outranks busy for the same
   * reason — a paused run is not acting, and saying "OCADE is working" while
   * nothing moves is the simulated progress this phase exists to remove.
   */
  const executor = mission.handedOver
    ? "You have the keyboard and mouse. OCADE is standing by."
    : mission.paused && mission.busy
      ? "Paused. OCADE is holding the work where it is."
      : mission.busy
        ? "OCADE, on this computer."
        : mission.activeRunCount > 0
          ? "Nothing in this room. Other OCADE work is still running."
          : "Nobody. Nothing is running.";

  /** The step being taken right now, said in the words the timeline uses. */
  const currentAction = useMemo(() => {
    const acting = [...mission.live].reverse().find((entry) => entry.kind !== "said");
    if (!acting) return null;
    return acting.detail ? `${acting.label} — ${acting.detail}` : acting.label;
  }, [mission.live]);

  /*
   * RECEIPTS: WHAT WAS DONE, AND WHETHER OCADE COULD CONFIRM IT.
   *
   * Taken from the finished turns rather than the live list, because a receipt
   * is a claim about something that already happened. `verified === false` is
   * the only value that means "looked, and the change was not there" — an
   * absent flag means the step was a read and had nothing to confirm, so it is
   * not reported as unconfirmed.
   */
  const receipts = useMemo(
    () =>
      mission.turns
        .flatMap((turn) => turn.entries ?? [])
        .filter((entry) => entry.kind === "done" || entry.kind === "problem")
        .slice(-8)
        .reverse(),
    [mission.turns],
  );

  const withheld = [...mission.policyCeiling.toolDomains];

  return (
    <div
      className={cn("space-y-3.5 text-[11.5px] leading-relaxed", className)}
      aria-label="Command Center"
    >
      <Section title="This computer">
        <Line
          label={start ? (start.ok ? "Connected" : "Not reachable") : "Not asked yet"}
          detail={
            start?.ok
              ? (start.activeWindow?.title ?? "Nothing in front")
              : (start?.detail ?? (mission.connecting ? "Reading this computer…" : ""))
          }
          tone={start?.ok ? "ok" : start ? "bad" : "muted"}
        />
        {start?.ok && typeof start.machine?.cpuPercent === "number" ? (
          <Line
            label="Load"
            detail={`Processor ${Math.round(start.machine.cpuPercent)}%${
              typeof start.machine.memoryUsedPercent === "number"
                ? ` · Memory ${Math.round(start.machine.memoryUsedPercent)}%`
                : ""
            }`}
            tone="muted"
          />
        ) : null}
        {!start?.ok && !mission.connecting ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-1 h-7 rounded-full px-3 text-[11px]"
            onClick={() => void mission.connect()}
          >
            Try again
          </Button>
        ) : null}
      </Section>

      <Section title="This browser">
        {/*
          The extension's own handshake, not an assumption. A page cannot know
          an extension is present until the extension answers, so "checking"
          and "never answered" are different states and both are said.
        */}
        <Line
          label={
            extensionChecking && !extension
              ? "Checking…"
              : extension?.installed && extension.compatible
                ? "Connected"
                : extension?.installed
                  ? "Needs updating"
                  : "Not connected"
          }
          detail={
            extension?.installed && extension.compatible
              ? `Extension ${extension.version ?? "installed"} answered on this site. OCADE can act inside the sites you approve in its popup, and nowhere else.`
              : (extension?.reason ??
                "Without it this page cannot open a tab, read a page or click anything outside itself.")
          }
          tone={extension?.installed && extension.compatible ? "ok" : "bad"}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-1 h-7 gap-1.5 rounded-full px-3 text-[11px]"
          disabled={extensionChecking}
          onClick={onRecheckExtension}
        >
          <RefreshCw
            className={cn("h-3 w-3", extensionChecking ? "animate-spin" : "")}
            aria-hidden
          />
          Check again
        </Button>
      </Section>

      <Section title="Who is acting">
        <Line label={executor} detail="" tone={mission.handedOver ? "muted" : "ok"} />
        {mission.activeRunCount > 0 ? (
          <Line
            label={`${mission.activeRunCount} running`}
            detail="Everywhere in OCADE, including work this room did not start."
            tone="muted"
          />
        ) : null}
      </Section>

      <Section title="Permission">
        <Line
          label={mission.mode === "voice" ? "Hands-free" : "Prompt"}
          detail={
            mission.mode === "voice"
              ? "OCADE reads risky questions out loud and waits for an answer either way."
              : "OCADE asks here, in the conversation, before anything that is not trivial to undo."
          }
          tone="muted"
        />
        {mission.approval ? (
          <Line label="Waiting on you" detail={mission.approval.question} tone="warn" />
        ) : null}
        <Line
          label={withheld.length === 0 ? "Nothing withheld" : `${withheld.length} withheld`}
          detail={
            withheld.length === 0
              ? "Your organizations have not turned anything off for this account."
              : `Turned off for this account: ${withheld.join(", ")}.`
          }
          tone={withheld.length === 0 ? "muted" : "warn"}
        />
      </Section>

      <Section title="Current action">
        <Line
          label={currentAction ?? "Nothing running"}
          detail=""
          tone={currentAction ? "ok" : "muted"}
        />
      </Section>

      <Section title="Receipts">
        {receipts.length === 0 ? (
          <Line label="Nothing done yet" detail="" tone="muted" />
        ) : (
          <ul className="space-y-1">
            {receipts.map((entry) => (
              <li key={entry.id} className="text-muted-foreground">
                <span className="text-foreground/80">{entry.label}</span>
                {entry.detail ? ` — ${entry.detail}` : ""}{" "}
                <span
                  className={
                    entry.kind === "problem" || entry.verified === false
                      ? "text-destructive/85"
                      : "text-muted-foreground/70"
                  }
                >
                  {entry.kind === "problem"
                    ? "(failed)"
                    : entry.verified === false
                      ? "(not confirmed on screen)"
                      : entry.verified === true
                        ? "(confirmed)"
                        : "(nothing to confirm)"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Diagnostics">
        {mission.error ? <Line label="Last problem" detail={mission.error} tone="bad" /> : null}
        <Line
          label={`${mission.toolCount} actions available on this device`}
          detail=""
          tone="muted"
        />
        {mission.lastLatency ? (
          <Line
            label="Last step"
            /*
             * Where the time actually went, in the three places it can go.
             * A single total hides the one thing this answers: a slow step is
             * either the router, the engine or the machine, and they have
             * different remedies.
             */
            detail={`Routing ${Math.round(mission.lastLatency.routerMs)}ms · thinking ${Math.round(
              mission.lastLatency.modelMs,
            )}ms · acting ${Math.round(mission.lastLatency.toolMs)}ms${
              mission.lastLatency.rule ? ` · ${mission.lastLatency.rule}` : ""
            }`}
            tone="muted"
          />
        ) : null}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground/60">
        {title}
      </h3>
      <div className="mt-1 space-y-1">{children}</div>
    </section>
  );
}

function Line({
  label,
  detail,
  tone,
}: {
  label: string;
  detail: string;
  tone: "ok" | "bad" | "warn" | "muted";
}) {
  return (
    <p className="text-muted-foreground">
      <span
        className={cn(
          tone === "bad"
            ? "text-destructive/85"
            : tone === "warn"
              ? "text-[oklch(0.72_0_0)]"
              : "text-foreground/85",
        )}
      >
        {label}
      </span>
      {detail ? ` — ${detail}` : ""}
    </p>
  );
}
