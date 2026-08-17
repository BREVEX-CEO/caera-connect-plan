import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const expectAll = (path: string, patterns: RegExp[]) => {
  const text = source(path);
  for (const pattern of patterns) expect(text, `${path} should match ${pattern}`).toMatch(pattern);
  return text;
};

describe("OCADE 77 — unavailable runtime boundaries", () => {
  it("#49 refuses to promise background push delivery", () => {
    expectAll("src/routes/_authenticated/ocade.notifications.tsx", [
      /CapabilityBadge status="NOT_CONFIGURED"/,
      /No web-push, APNs, FCM, SMS or email notification channel is configured/,
      /does not promise an alert outside the open application/i,
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

  it("#65 tells Work users file attachment is not configured", () => {
    expectAll("src/routes/_authenticated/ocade.work.tsx", [
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
