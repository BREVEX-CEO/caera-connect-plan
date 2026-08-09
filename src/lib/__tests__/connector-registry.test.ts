import { describe, expect, it } from "vitest";
import {
  ConnectorRegistry,
  type ConnectorManifest,
  type ConnectorRequirement,
} from "../control/connector-registry";

const manifest = (id: string, over: Partial<ConnectorManifest> = {}): ConnectorManifest => ({
  schemaVersion: 1,
  connectorId: id,
  displayName: id,
  kind: "mcp",
  route: "mcp",
  capabilities: [
    {
      id: "document.read",
      access: "read",
      risk: "read",
      requiredScopes: ["document.read"],
      verificationRoute: "file",
      reversible: true,
    },
  ],
  scope: { appIds: ["*"], domains: [], deviceIds: [] },
  auth: { state: "ready", requiredScopes: [], humanControlledFields: ["password", "otp"] },
  availability: "local_only",
  health: "healthy",
  latencyMs: 25,
  privacy: "on_device",
  enabled: true,
  observedAt: "2026-08-09T00:00:00.000Z",
  evidence: ["Observed a real connector health response."],
  ...over,
});

const requirement = (over: Partial<ConnectorRequirement> = {}): ConnectorRequirement => ({
  capabilityId: "document.read",
  access: "read",
  maximumRisk: "read",
  grantedScopes: ["document.read"],
  appId: "unknown.editor",
  online: false,
  allowedPrivacy: ["on_device"],
  ...over,
});

describe("typed connector registry", () => {
  it("selects the strongest healthy matching route without user technology choice", () => {
    const registry = new ConnectorRegistry();
    registry.register(manifest("plugin", { kind: "plugin", route: "plugin", latencyMs: 1 }));
    registry.register(manifest("mcp", { latencyMs: 100 }));
    registry.register(manifest("api", { kind: "application_api", route: "api", latencyMs: 500 }));
    expect(registry.select(requirement())).toMatchObject({
      ok: true,
      connector: { connectorId: "api", route: "api" },
    });
  });

  it("refuses absent auth, scope, health, privacy and app scope instead of guessing", () => {
    const registry = new ConnectorRegistry();
    registry.register(
      manifest("blocked", {
        auth: {
          state: "required",
          requiredScopes: ["account.read"],
          humanControlledFields: ["otp"],
        },
        health: "unknown",
        privacy: "cloud",
        scope: { appIds: ["different.app"], domains: [], deviceIds: [] },
      }),
    );
    const result = registry.select(requirement());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.evaluations[0].reasons).toEqual(
        expect.arrayContaining([
          "health unavailable",
          "authentication not ready",
          "privacy class refused",
          "application scope mismatch",
          "scope account.read missing",
        ]),
      );
    }
  });

  it("keeps password, OTP, CAPTCHA, biometric and payment fields human-controlled", () => {
    const registry = new ConnectorRegistry();
    registry.register(
      manifest("human-boundary", {
        auth: {
          state: "ready",
          requiredScopes: [],
          humanControlledFields: ["password", "otp", "captcha", "biometric", "payment"],
        },
      }),
    );
    expect(registry.list()[0].auth.humanControlledFields).toEqual([
      "password",
      "otp",
      "captcha",
      "biometric",
      "payment",
    ]);
  });

  it("records measured health and supports disable, forget and export", () => {
    const registry = new ConnectorRegistry();
    registry.register(manifest("local"));
    registry.recordHealth({
      connectorId: "local",
      health: "degraded",
      latencyMs: 900,
      observedAt: "2026-08-09T01:00:00.000Z",
      evidence: "Observed a slow but successful response.",
    });
    expect(registry.list()[0]).toMatchObject({ health: "degraded", latencyMs: 900 });
    registry.setEnabled("local", false);
    expect(registry.select(requirement()).ok).toBe(false);
    expect(registry.remove("local")).toBe(true);
    expect(registry.list()).toEqual([]);
  });

  it("refuses malformed manifests", () => {
    const registry = new ConnectorRegistry();
    expect(() => registry.register(manifest("bad id"))).toThrow(/malformed/i);
  });
});
