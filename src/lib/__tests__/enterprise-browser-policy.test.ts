import { createHash, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  generateEnterpriseBrowserPolicyBundle,
  validateEnterpriseBrowserPolicy,
  verifyEnterpriseBrowserPolicyBundle,
} from "../../../scripts/enterprise-browser-policy.mjs";

const policy = JSON.parse(readFileSync("release/OCADE_ENTERPRISE_BROWSER_POLICY.json", "utf8"));
const keys = generateKeyPairSync("ed25519");
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const NOW = new Date("2026-07-30T17:12:00.000Z");
const input = {
  bundleId: "browser-policy-1",
  tenantId: "tenant-a",
  adminId: "admin-a",
  browser: "chrome",
  operatingSystem: "windows",
  extensionId: "abcdefghijklmnopabcdefghijklmnop",
  version: "0.1.0",
  extensionPackageSha256: sha("extension-0.1.0"),
  updateUrl: "https://updates.caeracadane.com/chrome/update.xml",
  allowedOrigins: ["https://app.caeracadane.com/*", "https://tenant-a.caeracadane.com/*"],
  permissions: ["tabs", "scripting"],
  mode: "force-install",
  incognitoAllowed: false,
  previousVersion: "0.0.9",
  previousPackageSha256: sha("extension-0.0.9"),
  rollbackUpdateUrl: "https://updates.caeracadane.com/chrome/rollback.xml",
  expiresAt: "2026-07-30T18:12:00.000Z",
};

function generated(overrides: Record<string, unknown> = {}) {
  return generateEnterpriseBrowserPolicyBundle(policy, { ...input, ...overrides }, keys.privateKey);
}

describe("HWE-22 enterprise browser policy deployment", () => {
  it("validates Chrome/Edge, desktop OS, least-authority, signature and rollback policy", () => {
    expect(validateEnterpriseBrowserPolicy(policy)).toEqual({ ok: true, issues: [] });
  });

  it("generates a signed force-install Chrome policy with least-privilege origins", () => {
    const result = generated();
    expect(result.ok).toBe(true);
    const payload = result.envelope.payload;
    expect(payload.policy.ExtensionInstallForcelist).toEqual([
      `${input.extensionId};${input.updateUrl}`,
    ]);
    expect(payload.policy.ExtensionSettings[input.extensionId]).toMatchObject({
      installation_mode: "force_installed",
      runtime_allowed_hosts: input.allowedOrigins,
      runtime_blocked_hosts: ["*://*/*"],
      minimum_version_required: "0.1.0",
    });
  });

  it("generates a normal-install Edge/macOS policy without a false force-list entry", () => {
    const result = generated({
      browser: "edge",
      operatingSystem: "macos",
      mode: "normal-install",
    });
    expect(result.ok).toBe(true);
    expect(result.envelope.payload.policy.ExtensionInstallForcelist).toEqual([]);
    expect(
      result.envelope.payload.policy.ExtensionSettings[input.extensionId].installation_mode,
    ).toBe("normal_installed");
  });

  it("refuses wildcard/dev origins, insecure or unapproved update hosts and forbidden permissions", () => {
    const result = generated({
      updateUrl: "http://evil.example/update.xml",
      rollbackUpdateUrl: "https://evil.example/rollback.xml",
      allowedOrigins: ["*://*/*", "http://localhost/*"],
      permissions: ["tabs", "cookies", "nativeMessaging"],
    });
    expect(result.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["update_url", "rollback_url", "origin_scope", "permission"]),
    );
  });

  it("refuses unsupported browser/OS, extension IDs, incognito and missing rollback data", () => {
    const result = generated({
      browser: "firefox",
      operatingSystem: "android",
      extensionId: "bad-id",
      incognitoAllowed: true,
      previousVersion: "",
      previousPackageSha256: "",
      rollbackUpdateUrl: "",
    });
    expect(result.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "browser",
        "operating_system",
        "extension_id",
        "incognito",
        "rollback",
      ]),
    );
  });

  it("verifies signature, tenant, exact extension package, platform, rollback and revocation", () => {
    const envelope = generated().envelope;
    expect(
      verifyEnterpriseBrowserPolicyBundle(policy, envelope, keys.publicKey, {
        tenantId: "tenant-a",
        extensionId: input.extensionId,
        extensionPackageSha256: input.extensionPackageSha256,
        now: NOW,
        seenBundleIds: new Set(),
      }),
    ).toMatchObject({
      ok: true,
      receipt: {
        bundleId: "browser-policy-1",
        browser: "chrome",
        operatingSystem: "windows",
        evidenceClass: "SIGNED ENTERPRISE POLICY BUNDLE - DEVICE-MANAGEMENT APPLY REQUIRED",
        appliedToDeviceManagement: false,
      },
    });
    expect(envelope.payload.rollback).toMatchObject({
      version: "0.0.9",
      requiresAdminApproval: true,
    });
    expect(envelope.payload.revocation.ExtensionSettings[input.extensionId].installation_mode).toBe(
      "blocked",
    );
  });

  it("refuses a tampered bundle signature", () => {
    const envelope = generated().envelope;
    const tampered = {
      ...envelope,
      payload: { ...envelope.payload, extensionVersion: "9.9.9" },
    };
    expect(
      verifyEnterpriseBrowserPolicyBundle(policy, tampered, keys.publicKey, {
        tenantId: "tenant-a",
        extensionId: input.extensionId,
        extensionPackageSha256: input.extensionPackageSha256,
        now: NOW,
      }).issues,
    ).toContainEqual(expect.objectContaining({ code: "signature" }));
  });

  it("refuses tenant drift, expiry, replay and extension-package mismatch", () => {
    const envelope = generated({ expiresAt: "2026-07-30T17:00:00.000Z" }).envelope;
    const result = verifyEnterpriseBrowserPolicyBundle(policy, envelope, keys.publicKey, {
      tenantId: "tenant-b",
      extensionId: input.extensionId,
      extensionPackageSha256: sha("other-package"),
      now: NOW,
      seenBundleIds: new Set(["browser-policy-1"]),
    });
    expect(result.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["tenant", "expired", "replay", "package"]),
    );
  });

  it("refuses policy bundles that remove external admin authority or revocation", () => {
    const envelope = generated().envelope;
    const stripped = {
      payload: {
        ...envelope.payload,
        administrativeApply: "APPLIED_BY_OCADE",
        revocation: { requiresAdminApproval: false, ExtensionSettings: {} },
      },
      signature: envelope.signature,
    };
    const result = verifyEnterpriseBrowserPolicyBundle(policy, stripped, keys.publicKey, {
      tenantId: "tenant-a",
      extensionId: input.extensionId,
      extensionPackageSha256: input.extensionPackageSha256,
      now: NOW,
    });
    expect(result.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["signature", "authority"]),
    );
  });

  it("honours cancellation before generation or verification", () => {
    const controller = new AbortController();
    controller.abort();
    expect(() =>
      generateEnterpriseBrowserPolicyBundle(policy, input, keys.privateKey, {
        signal: controller.signal,
      }),
    ).toThrow(/cancelled/);
    expect(() =>
      verifyEnterpriseBrowserPolicyBundle(policy, generated().envelope, keys.publicKey, {
        signal: controller.signal,
      }),
    ).toThrow(/cancelled/);
  });
});
