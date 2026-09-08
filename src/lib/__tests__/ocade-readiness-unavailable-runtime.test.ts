import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

/**
 * Collapse runs of whitespace before matching.
 *
 * These patterns assert that a SENTENCE is present in a screen's copy. They
 * were matched against raw source, so they also — accidentally — asserted how
 * the formatter had chosen to wrap it. A prettier pass that broke one line
 * into two failed the test while the words on screen were byte-identical.
 *
 * Pinning wording is the point; pinning line breaks is noise that trains
 * people to "fix" a real assertion by reflowing a file. The patterns still
 * fail if the sentence is removed or reworded.
 */
const flatten = (text: string) => text.replace(/\s+/g, " ");

const expectAll = (path: string, patterns: RegExp[]) => {
  const text = source(path);
  const flat = flatten(text);
  for (const pattern of patterns) {
    expect(flat, `${path} should match ${pattern}`).toMatch(pattern);
  }
  return text;
};

describe("OCADE 77 — unavailable runtime boundaries", () => {
  it("#49 refuses to promise background push delivery", () => {
    /*
     * THE BADGE IS DERIVED, NOT WRITTEN DOWN, and this assertion changed to
     * demand that.
     *
     * It used to require the literal `CapabilityBadge status="NOT_CONFIGURED"`,
     * which was the right check while the page was a static statement. Once the
     * page grew a real notification history it began reading
     * `resolveChannels(deploymentChannelConfiguration())` — the same authority
     * the settings screen and the sender use — so the badge tells the truth on a
     * deployment that DOES configure a provider, which a hardcoded one never
     * could. Requiring the literal would now be requiring a lie in waiting.
     *
     * What is asserted instead is stronger: the status comes from the channel
     * authority, the unconfigured branch still says so in words, and each
     * channel's own reason is shown rather than one blanket sentence.
     */
    expectAll("src/routes/_authenticated/ocade.notifications.tsx", [
      /deploymentChannelConfiguration\(\)/,
      /CapabilityBadge status=\{anyPush \? "READY" : "NOT_CONFIGURED"\}/,
      /No web-push, APNs, FCM or email channel is configured by this build/,
      /does not promise an alert outside the open application/i,
      // Each channel says why it is unavailable, so "not configured" is not the
      // whole of what a person is told.
      /channel\.unavailableReason/,
    ]);
  });

  it("#61 refuses to simulate Code terminal output without a verified host", () => {
    expectAll("src/components/ocade/CodeWorkspacePanel.tsx", [
      /kind: "unavailable"/,
      /will not simulate terminal output/i,
      /Unavailable hosts must never be dispatched/,
    ]);
    expectAll("src/lib/capabilities/use-capabilities.ts", [
      /report\.id === "codeTerminal"/,
      /status: "NOT_CONFIGURED" as const/,
      /dedicated command-host heartbeat/i,
    ]);
  });

  it("#65 tells Cowork users file attachment is not configured", () => {
    // Was `/ocade/work`; PLAN.md §4 moved the room to `/ocade/cowork`. The
    // disclosure it must carry is unchanged.
    expectAll("src/routes/_authenticated/ocade.cowork.tsx", [
      /file attachment is not configured yet/i,
      /ControlWorkPanel/,
    ]);
  });

  it("#69 never infers global automation readiness from shell presence", () => {
    expectAll("src/lib/capabilities/use-capabilities.ts", [
      /automationRunner: \{ available: false \}/,
      /native shell alone is not proof/i,
      /No dedicated automation-worker heartbeat/i,
    ]);
  });

  it("#71 never claims monitor polling without a runner heartbeat", () => {
    expectAll("src/lib/capabilities/use-capabilities.ts", [
      /monitors: \{ configuredCount: configuredMonitors, runnerAvailable: false \}/,
      /no dedicated monitor-runner heartbeat/i,
    ]);
    expectAll("src/routes/_authenticated/ocade.monitors.tsx", [
      /No monitor runner is polling these definitions/,
      /will not claim that checks or alerts are running until a real runner heartbeat is available/i,
    ]);
  });
});
