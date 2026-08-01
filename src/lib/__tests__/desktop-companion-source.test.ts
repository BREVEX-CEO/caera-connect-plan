import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

/**
 * Read a source file with newlines normalised to "\n".
 *
 * Several assertions below match multi-line snippets written with "\n" — for
 * example `app.emit(\n        "ocade://action-progress"`. This repository has
 * `core.autocrlf=true` and no `.gitattributes`, so git hands a fresh checkout
 * CRLF copies and those assertions fail on any machine that did not write the
 * files itself. That made this suite pass locally and fail in CI, which is the
 * least useful combination a test can have. Normalising on read asserts on the
 * source's content rather than on how git happened to check it out.
 */
const readSource = (relativePath: string): string =>
  readFileSync(resolve(root, relativePath), "utf8").replace(/\r\n/g, "\n");

const main = readSource("native/companion/tauri/src/main.rs");
const platform = readSource("native/companion/tauri/src/platform.rs");
const safety = readSource("native/companion/safety/src/lib.rs");
const overlay = readSource("native/companion/ui/overlay.js");
const buildScript = readSource("native/companion/tauri/build.rs");
interface TauriConfig {
  app: { withGlobalTauri: boolean; security: { csp: string; freezePrototype: boolean } };
  bundle: {
    createUpdaterArtifacts: boolean;
    windows: { certificateThumbprint: string | null };
    macOS: { signingIdentity: string | null };
  };
  plugins: { updater: { active: boolean; pubkey: string } };
}

const config = JSON.parse(
  readFileSync(resolve(root, "native/companion/tauri/tauri.conf.json"), "utf8"),
) as TauriConfig;

describe("desktop companion source contract", () => {
  it("exposes Tauri IPC to the dependency-free overlay under a restrictive CSP", () => {
    expect(buildScript).toContain("tauri_build::build()");
    expect(config.app.withGlobalTauri).toBe(true);
    expect(config.app.security.csp).toContain("default-src 'self'");
    expect(config.app.security.csp).not.toContain("https:");
    expect(config.app.security.freezePrototype).toBe(true);
  });

  it("uses HMAC-SHA-256 and binds signed bodies to deserialized command arguments", () => {
    expect(main).toContain("fn verify_signed<T: Serialize>");
    for (const command of [
      "close_session",
      "set_allowlist",
      "execute",
      "observe",
      "cancel",
      "reset_emergency_stop",
      "application_inventory",
    ]) {
      expect(main).toContain(`"${command}"`);
    }
    expect(main).toContain("request.body != expected");
  });

  it("discovers exact host capabilities instead of advertising a scaffold", () => {
    expect(main).toContain("let backend = platform::discover()");
    expect(main).toContain("available: backend.available");
    expect(platform).toContain("pub fn discover() -> BackendStatus");
    expect(main).not.toContain("RUNTIME_UNAVAILABLE_REASON");
  });

  it("reports permission setup honestly and authenticates redacted application discovery", () => {
    expect(platform).toContain("pub struct PermissionStatus");
    expect(platform).toContain("fn permission_statuses()");
    expect(platform).toContain('"interactive_desktop"');
    expect(platform).toContain('"accessibility"');
    expect(platform).toContain('"screen_capture"');
    expect(platform).toContain('"input_control"');
    expect(platform).toContain("pub fn application_inventory(");
    expect(platform).toContain("[protected window]");
    expect(main).toContain("permissions: backend.permissions");
    expect(main).toContain("install_guidance: backend.install_guidance");
    expect(main).toMatch(/verify_signed\(\s*&state,\s*&request,\s*"application_inventory"/s);
  });

  it("implements bounded OS actions without interpolating user values into scripts", () => {
    for (const capability of [
      "ScreenRead",
      "WindowList",
      "AccessibilityRead",
      "WindowFocus",
      "WindowArrange",
      "AppOpen",
      "FileOpen",
    ]) {
      expect(platform).toContain(`CompanionAction::${capability}`);
    }
    expect(platform).toContain("ACTION_TIMEOUT");
    expect(platform).toContain("child.kill()");
    expect(platform).toContain("sha256_hex(&bytes)");
    expect(platform).toContain("UIAutomationClient");
    expect(platform).toContain("[protected control]");
  });

  it("keeps cancel and emergency stop live while actions run", () => {
    expect(main).toContain("tauri::async_runtime::spawn_blocking");
    expect(main).toContain('app.emit(\n        "ocade://action-progress"');
    expect(main).toMatch(/state\s*\.emergency\s*\.register\(&run_id\)/s);
    expect(main.match(/state\.emergency\.halt\(\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(safety).toContain("pub struct EmergencyStopRegistry");
    expect(safety).toContain("struct EmergencyStopState");
    expect(safety).toContain("halted: bool");
    expect(safety).toContain("running: HashMap<String, Arc<AtomicBool>>");
  });

  it("bounds long-lived native sessions, envelopes, audit entries, captures, and results", () => {
    const ipc = readFileSync(resolve(root, "native/companion/safety/src/ipc.rs"), "utf8");
    expect(ipc).toContain("MAX_SESSIONS");
    expect(ipc).toContain("MAX_ENVELOPE_BODY_BYTES");
    expect(ipc).toContain("VecDeque");
    expect(main).toContain("MAX_AUDIT_ENTRIES");
    expect(main).toContain("MAX_OPERATION_RESULTS");
    expect(platform).toContain("MAX_CAPTURES");
  });

  it("persists permissions and recovers unknown crash outcomes without replay", () => {
    expect(main).toContain("allowlist-v1.json");
    expect(main).toContain("file.sync_all()");
    expect(main).toContain("The companion restarted before this operation");
    expect(main).toContain("it was not replayed");
  });

  it("signs privileged overlay controls and leaves emergency stop always reachable", () => {
    expect(overlay).toContain('{ name: "HMAC", hash: "SHA-256" }');
    expect(overlay).toContain('signed("cancel", args)');
    expect(overlay).toContain('signed("reset_emergency_stop", {})');
    expect(overlay).toContain('invoke("emergency_stop")');
  });

  it("keeps updater and signing claims externally blocked until real keys exist", () => {
    expect(config.plugins.updater.active).toBe(false);
    expect(config.plugins.updater.pubkey).toBe("REPLACE_WITH_SIGNING_PUBLIC_KEY");
    expect(config.bundle.windows.certificateThumbprint).toBeNull();
    expect(config.bundle.macOS.signingIdentity).toBeNull();
    expect(config.bundle.createUpdaterArtifacts).toBe(false);
    const windowsConfig = JSON.parse(
      readFileSync(resolve(root, "native/companion/tauri/tauri.windows.conf.json"), "utf8"),
    ) as { bundle: { targets: string[] } };
    expect(windowsConfig.bundle.targets).toEqual(["msi", "nsis"]);
  });
});
