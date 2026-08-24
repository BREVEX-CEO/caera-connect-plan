import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { OCADE_RELEASE_VERSION, releaseHealthResponse } from "../release-health";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const json = <T>(path: string): T => JSON.parse(read(path)) as T;

describe("OCADE release source package", () => {
  it("uses one prerelease version across web, desktop, Android, and iOS", () => {
    const pkg = json<{ name: string; version: string }>("package.json");
    const tauri = json<{ version: string }>("native/companion/tauri/tauri.conf.json");
    const android = read("android/app/build.gradle");
    const ios = read("ios/App/App.xcodeproj/project.pbxproj");

    expect(pkg.name).toBe("caera-cadane-ocade");
    expect(pkg.version).toBe(OCADE_RELEASE_VERSION);
    expect(tauri.version).toBe(OCADE_RELEASE_VERSION);
    expect(android).toContain(`versionName "${OCADE_RELEASE_VERSION}"`);
    expect(ios.match(/MARKETING_VERSION = ([^;]+);/g)).toEqual([
      `MARKETING_VERSION = ${OCADE_RELEASE_VERSION};`,
      `MARKETING_VERSION = ${OCADE_RELEASE_VERSION};`,
    ]);
  });

  it("keeps the Capacitor CLI toolchain out of the production dependency graph", () => {
    const pkg = json<{
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    }>("package.json");
    const lock = json<{
      packages: Record<
        string,
        {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
          dev?: boolean;
        }
      >;
    }>("package-lock.json");

    expect(pkg.dependencies["@capacitor/cli"]).toBeUndefined();
    expect(pkg.devDependencies["@capacitor/cli"]).toBe("^8.4.2");
    expect(lock.packages[""].dependencies?.["@capacitor/cli"]).toBeUndefined();
    expect(lock.packages[""].devDependencies?.["@capacitor/cli"]).toBe("^8.4.2");
    expect(lock.packages["node_modules/@capacitor/cli"].dev).toBe(true);
    expect(lock.packages["node_modules/glob/node_modules/brace-expansion"].dev).toBe(true);
  });

  it("has deterministic Cloudflare source configuration without committed secrets", () => {
    const config = json<{
      name: string;
      compatibility_date: string;
      compatibility_flags: string[];
      keep_vars: boolean;
      routes: Array<{ pattern: string; zone_name: string }>;
      observability: { enabled: boolean };
      assets: { run_worker_first: boolean };
      vars?: unknown;
    }>("wrangler.json");

    expect(config.name).toBe("ocade-web");
    expect(config.compatibility_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(config.compatibility_flags).toContain("nodejs_compat");
    expect(config.keep_vars).toBe(true);
    expect(config.routes).toEqual([
      { pattern: "ocade.in/*", zone_name: "ocade.in" },
      { pattern: "www.ocade.in/*", zone_name: "ocade.in" },
    ]);
    expect(config.observability.enabled).toBe(true);
    expect(config.assets.run_worker_first).toBe(true);
    expect(config.vars).toBeUndefined();
  });

  it("keeps the browser-only WebLLM runtime out of the Cloudflare server bundle", () => {
    const nitro = read("nitro.config.ts");
    const serverShim = read("src/lib/brain/adapters/webllm.server.ts");

    expect(nitro).toContain('"@mlc-ai/web-llm"');
    expect(nitro).toContain("webllm.server.ts");
    expect(serverShim).toContain("available only inside a user's browser");
    expect(read("src/lib/brain/adapters/browser-webgpu.ts")).toContain('import("@mlc-ai/web-llm")');
  });

  it("gates uploaded static assets before Nitro can forward them", () => {
    const nitro = read("nitro.config.ts");
    const edge = read("src/cloudflare-entry.ts");
    expect(nitro).toContain('entry: "./src/cloudflare-entry.ts"');
    expect(edge).toContain("isPublicAssetURL(url.pathname)");
    expect(edge).toContain('headers.set("x-ocade-edge-gate", "asset-v1")');
    expect(edge.indexOf("evaluateLaunchGate({")).toBeLessThan(
      edge.indexOf("env.ASSETS.fetch(request)"),
    );
  });

  it("provides a dependency-free liveness endpoint with safe method and cache boundaries", async () => {
    const request = new Request("https://ocade.invalid/api/health");
    Object.assign(request, {
      runtime: {
        cloudflare: {
          env: {
            CF_VERSION_METADATA: { id: "cf-version-123", tag: "release-test" },
            SUPABASE_URL: "https://project.supabase.co",
            SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
          },
        },
      },
    });
    const get = releaseHealthResponse(request);
    expect(get?.status).toBe(200);
    expect(get?.headers.get("cache-control")).toBe("no-store");
    expect(get?.headers.get("x-content-type-options")).toBe("nosniff");
    await expect(get?.json()).resolves.toMatchObject({
      status: "ok",
      service: "ocade-web",
      version: OCADE_RELEASE_VERSION,
      deploymentId: "cf-version-123",
      deploymentTag: "release-test",
      configuration: { supabasePublic: true },
      scope: "liveness",
    });

    const head = releaseHealthResponse(
      new Request("https://ocade.invalid/api/health", { method: "HEAD" }),
    );
    expect(await head?.text()).toBe("");

    const post = releaseHealthResponse(
      new Request("https://ocade.invalid/api/health", { method: "POST" }),
    );
    expect(post?.status).toBe(405);
    expect(post?.headers.get("allow")).toBe("GET, HEAD");
    expect(releaseHealthResponse(new Request("https://ocade.invalid/ocade"))).toBeNull();
  });

  it("routes liveness before loading the application SSR entry", () => {
    const server = read("src/server.ts");
    expect(server).toContain("releaseHealthResponse(request, runtimeEnv)");
    expect(server).toContain("evaluateLaunchGate({");
    expect(server).toContain("prelaunchResponse(url.pathname, gate)");
    expect(server.indexOf("releaseHealthResponse(request, runtimeEnv)")).toBeLessThan(
      server.indexOf("evaluateLaunchGate({"),
    );
    expect(server.indexOf("evaluateLaunchGate({")).toBeLessThan(
      server.indexOf("const handler = await getServerEntry()"),
    );
  });

  it("keeps the inactive desktop updater inaccessible to the overlay", () => {
    const config = json<{ plugins: { updater: { active: boolean } } }>(
      "native/companion/tauri/tauri.conf.json",
    );
    const capabilities = json<{ permissions: string[] }>(
      "native/companion/tauri/capabilities/default.json",
    );

    expect(config.plugins.updater.active).toBe(false);
    expect(capabilities.permissions).not.toContain("updater:default");
    expect(read("native/companion/README.md")).toMatch(
      /add `updater:default` only when the signed updater is enabled/i,
    );
  });

  it("retains release crash diagnostics without exposing source paths", () => {
    const gradle = read("android/app/build.gradle");
    const proguard = read("android/app/proguard-rules.pro");
    expect(gradle).toContain("debuggable false");
    expect(gradle).toContain("jniDebuggable false");
    expect(proguard).toContain("-keepattributes SourceFile,LineNumberTable");
    expect(proguard).toContain("-renamesourcefileattribute SourceFile");
  });

  it("ships a source gate, release checklist, and explicit external-blocker ledger", () => {
    const pkg = json<{ scripts: Record<string, string> }>("package.json");
    const blockers = json<{
      releaseVersion: string;
      status: string;
      blockers: Array<{ id: string; status: string; requiredEvidence: string[] }>;
    }>("release/OCADE_RELEASE_BLOCKERS.json");
    const checklist = read("release/OCADE_RELEASE_CHECKLIST.md");
    const cloudflare = json<{
      classification: string;
      deployment: { immutableHashedAssetProbePassed: boolean; postPromotionHealthPassed: boolean };
      realChromeQA: { status: string; consoleErrors: number };
    }>("release/OCADE_CLOUDFLARE_LIVE_PROOF.json");

    expect(pkg.scripts["release:source-check"]).toBe("node scripts/check-release-source.mjs");
    expect(existsSync(resolve(root, "scripts/check-release-source.mjs"))).toBe(true);
    expect(blockers.releaseVersion).toBe(OCADE_RELEASE_VERSION);
    expect(blockers.status).toBe("externally_blocked");
    expect(blockers.blockers.length).toBeGreaterThanOrEqual(6);
    for (const blocker of blockers.blockers) {
      expect(blocker.id).toMatch(/^[a-z0-9][a-z0-9-]{2,63}$/);
      expect(blocker.status).toBe("externally_blocked");
      expect(blocker.requiredEvidence.length).toBeGreaterThan(0);
    }
    expect(checklist).toContain("STOP RELEASE");
    expect(checklist).toContain("/api/health");
    expect(checklist).toContain("Cloudflare prelaunch Worker was deployed");
    expect(checklist).toContain("remains closed behind the production launch gate");
    expect(cloudflare.classification).toBe("EXECUTED PRELAUNCH DEPLOYMENT; LAUNCH NOT OPEN");
    expect(cloudflare.deployment.immutableHashedAssetProbePassed).toBe(true);
    expect(cloudflare.deployment.postPromotionHealthPassed).toBe(true);
    expect(cloudflare.realChromeQA).toEqual(
      expect.objectContaining({ status: "passed", consoleErrors: 0 }),
    );
  });
});
