import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync("src/routes/_authenticated/route.tsx", "utf8");
const bridge = readFileSync("src/components/commercial/OfflineUsageBridge.tsx", "utf8");
const panel = readFileSync("src/components/settings/CommercialUsagePanel.tsx", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260907011350_offline_usage_leases.sql",
  "utf8",
);

describe("offline commercial usage integration", () => {
  it("mounts exactly one signed-in bridge and keeps device registration inside it", () => {
    expect(route.match(/<OfflineUsageBridge\s*\/>/g)).toHaveLength(1);
    expect(route).not.toContain("registerDeviceForCurrentSession");
    expect(bridge).toContain("registerDeviceForCurrentSession");
  });

  it("reconciles first, refills at the quarter threshold, and preissues one window", () => {
    expect(bridge.indexOf("reconcileOfflineUsage")).toBeLessThan(
      bridge.indexOf('requestBlock("refill")'),
    );
    expect(bridge).toContain("allocated - unavailable <= allocated / 4");
    expect(bridge).toContain('requestBlock("preissue")');
    expect(migration).toContain("ocade_device_usage_leases_one_preissue_idx");
  });

  it("reports offline capacity separately without exposing paid raw amounts", () => {
    expect(panel).toContain("Offline allocation");
    expect(panel).toContain("reserved for offline devices");
    expect(panel).toContain("lease.usedPercent");
    expect(panel).toContain("lease.remainingPercent");
  });

  it("keeps usage tables content-free and inaccessible to browser roles", () => {
    expect(migration).toMatch(
      /REVOKE ALL ON TABLE public\.ocade_device_usage_leases FROM PUBLIC, anon, authenticated/,
    );
    expect(migration).not.toMatch(/\b(prompt|messages|response|attachment)\b\s+(?:text|jsonb)/i);
  });
});
