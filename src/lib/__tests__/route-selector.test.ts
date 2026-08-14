import { describe, expect, it } from "vitest";
import {
  UNIVERSAL_ROUTE_ORDER,
  selectUniversalRoute,
  type RouteSelectionInput,
  type UniversalRouteCandidate,
} from "../skills/route-selector";
import type { ActionRoute, RiskLevel } from "../skills/action-contract";

function candidate(
  route: ActionRoute,
  overrides: Partial<UniversalRouteCandidate> = {},
): UniversalRouteCandidate {
  return {
    candidateId: `candidate-${route}`,
    route,
    interfaceId: `interface-${route}`,
    available: true,
    officialOrApproved: true,
    supportedAppIds: ["app.editor"],
    versionPrefixes: ["2."],
    taskTypes: ["document.save"],
    requiredPermissions: ["document.write"],
    confidence: route === "input" ? 0.95 : 0.92,
    expectedLatencyMs: 250,
    verification: {
      route: route === "input" ? "accessibility" : route,
      confidence: 0.9,
      independent: true,
    },
    recovery: { route: "file", ready: true },
    health: "healthy",
    supportsRecording: true,
    evidence: `Observed ${route} fixture.`,
    ...overrides,
  };
}

function input(
  candidates: UniversalRouteCandidate[],
  overrides: Partial<RouteSelectionInput> = {},
): RouteSelectionInput {
  return {
    appIdentity: {
      appId: "app.editor",
      product: "Fixture Editor",
      version: "2.4.1",
      windowId: "window-1",
    },
    taskType: "document.save",
    risk: "low",
    grantedPermissions: ["document.write"],
    recordingPreference: "video_on",
    candidates,
    ...overrides,
  };
}

describe("universal route selector representative routes", () => {
  it.each(UNIVERSAL_ROUTE_ORDER)("selects an adequate %s route", (route) => {
    const result = selectUniversalRoute(input([candidate(route)]));
    expect(result).toMatchObject({
      ok: true,
      data: { route, interfaceId: `interface-${route}` },
    });
  });

  it("uses the exact API, approved bridge, CLI, file, DOM, accessibility, native, vision, input order", () => {
    const candidates = [...UNIVERSAL_ROUTE_ORDER].reverse().map((route) => candidate(route));
    const result = selectUniversalRoute(input(candidates));
    expect(result).toMatchObject({ ok: true, data: { route: "api" } });

    const api = candidates.find((item) => item.route === "api")!;
    const plugin = candidates.find((item) => item.route === "plugin")!;
    api.health = "failing";
    plugin.confidence = 0.94;
    const fallback = selectUniversalRoute(input(candidates));
    expect(fallback).toMatchObject({
      ok: true,
      data: { route: "plugin", fallbackFrom: ["api"] },
    });
  });

  it("uses confidence and latency inside a hierarchy tier without crossing the route order", () => {
    const result = selectUniversalRoute(
      input([
        candidate("mcp", {
          candidateId: "mcp-slower",
          expectedLatencyMs: 1_000,
          confidence: 0.91,
        }),
        candidate("plugin", {
          candidateId: "plugin-faster",
          expectedLatencyMs: 100,
          confidence: 0.93,
        }),
        candidate("cli", { confidence: 0.99, expectedLatencyMs: 1 }),
      ]),
    );
    expect(result).toMatchObject({
      ok: true,
      data: { candidateId: "plugin-faster", route: "plugin" },
    });

    const equalConfidence = selectUniversalRoute(
      input([
        candidate("mcp", {
          candidateId: "mcp-slower",
          expectedLatencyMs: 1_000,
          confidence: 0.93,
        }),
        candidate("plugin", {
          candidateId: "plugin-faster",
          expectedLatencyMs: 100,
          confidence: 0.93,
        }),
      ]),
    );
    expect(equalConfidence).toMatchObject({
      ok: true,
      data: { candidateId: "plugin-faster" },
    });
  });
});

describe("universal route selector safety and fallback", () => {
  it.each([
    ["identity", { supportedAppIds: ["another.app"] }],
    ["version", { versionPrefixes: ["3."] }],
    ["task", { taskTypes: ["document.read"] }],
    ["permission", { requiredPermissions: ["admin.write"] }],
    ["approval", { officialOrApproved: false }],
    ["health", { health: "failing" as const }],
    ["recording", { supportsRecording: false }],
    [
      "verification",
      { verification: { route: "api" as const, confidence: 0.9, independent: false } },
    ],
    ["recovery", { recovery: { route: "file" as const, ready: false } }],
    ["latency", { expectedLatencyMs: 31_000 }],
    ["confidence", { confidence: 0.4 }],
  ])("routes around an inadequate %s candidate with reasons", (_name, override) => {
    const result = selectUniversalRoute(
      input([candidate("api", override as Partial<UniversalRouteCandidate>), candidate("cli")]),
    );
    expect(result).toMatchObject({
      ok: true,
      data: { route: "cli", fallbackFrom: ["api"] },
    });
    if (result.ok) {
      expect(result.evaluations[0].adequate).toBe(false);
      expect(result.evaluations[0].reasons.length).toBeGreaterThan(0);
    }
  });

  it("requires explicit approval for a medium-risk coordinate fallback", () => {
    const candidates = [
      candidate("api", { available: false }),
      candidate("vision", { fallbackPolicy: "explicit", confidence: 0.95 }),
    ];
    expect(selectUniversalRoute(input(candidates, { risk: "medium" }))).toMatchObject({
      ok: false,
      code: "no_adequate_route",
    });
    expect(
      selectUniversalRoute(
        input(candidates, {
          risk: "medium",
          explicitCoordinateFallbackApproval: true,
        }),
      ),
    ).toMatchObject({ ok: true, data: { route: "vision" } });
  });

  it.each(["vision", "input"] as const)("never downgrades a high-risk mutation to %s", (route) => {
    const result = selectUniversalRoute(
      input([candidate("api", { available: false }), candidate(route, { confidence: 1 })], {
        risk: "high",
        explicitCoordinateFallbackApproval: true,
      }),
    );
    expect(result).toMatchObject({
      ok: false,
      code: "high_risk_coordinate_fallback",
    });
  });

  it.each(["read", "low", "medium", "high", "protected"] as RiskLevel[])(
    "refuses safely when no %s route is adequate",
    (risk) => {
      const result = selectUniversalRoute(
        input([candidate("api", { available: false })], { risk }),
      );
      expect(result.ok).toBe(false);
      expect(result).toHaveProperty("reason");
    },
  );

  it("refuses duplicate, malformed and unbounded route candidates", () => {
    const duplicate = candidate("api");
    expect(selectUniversalRoute(input([duplicate, { ...duplicate }]))).toMatchObject({
      ok: false,
      code: "malformed",
    });
    expect(
      selectUniversalRoute(input([candidate("api", { confidence: Number.NaN })])),
    ).toMatchObject({ ok: false, code: "malformed" });
    expect(
      selectUniversalRoute({
        ...input([candidate("api")]),
        recordingPreference: "always" as "video_on",
      }),
    ).toMatchObject({ ok: false, code: "identity_unresolved" });
  });
});
