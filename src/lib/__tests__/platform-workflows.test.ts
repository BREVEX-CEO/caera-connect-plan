import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

/**
 * Platform workflow guard.
 *
 * `platforms.yml` builds Android, iOS and the Windows companion — none of which
 * can be executed from a typical development machine. That makes it very easy
 * to write a job that references a directory or file which does not exist and
 * only discover it minutes into a CI run.
 *
 * That happened while writing it: the desktop job pointed `cargo build` at
 * `native/companion`, which holds safety/, tauri/ and ui/ but has NO manifest of
 * its own. The crate is `native/companion/tauri`. These tests assert every path
 * the workflow depends on is real, so that class of mistake fails here in
 * milliseconds instead of on a runner.
 *
 * HONEST STATUS: this workflow has never been executed. It is PREPARED
 * automation, not evidence. The tests below prove its references resolve — they
 * do not prove the builds succeed.
 */

const workflow = readFileSync(".github/workflows/platforms.yml", "utf8");
const capacitor = JSON.parse(readFileSync("capacitor.config.json", "utf8")) as {
  webDir: string;
  appId: string;
};

describe("every path the workflow references exists", () => {
  it("the Android gradle wrapper", () => {
    expect(workflow).toMatch(/working-directory:\s*android/);
    expect(existsSync("android/gradlew")).toBe(true);
  });

  it("the iOS Xcode project, with the scheme the workflow builds", () => {
    expect(existsSync("ios/App/App.xcodeproj")).toBe(true);
    expect(workflow).toMatch(/-project App\.xcodeproj/);
  });

  it("the Rust safety crate", () => {
    expect(workflow).toMatch(/working-directory:\s*native\/companion\/safety/);
    expect(existsSync("native/companion/safety/Cargo.toml")).toBe(true);
  });

  it("the companion crate — at tauri/, NOT the parent directory", () => {
    // The exact mistake this suite exists to catch.
    expect(workflow).toMatch(/working-directory:\s*native\/companion\/tauri/);
    expect(existsSync("native/companion/tauri/Cargo.toml")).toBe(true);
    expect(existsSync("native/companion/Cargo.toml")).toBe(false);
  });

  it("every cargo working-directory names a real crate", () => {
    const dirs = [...workflow.matchAll(/working-directory:\s*(native\/[\w/-]+)/g)].map((m) => m[1]);
    expect(dirs.length).toBeGreaterThan(0);
    const missing = dirs.filter((d) => !existsSync(`${d}/Cargo.toml`));
    expect(missing, `no Cargo.toml in: ${missing.join(", ")}`).toEqual([]);
  });

  it("the Capacitor web directory the sync step copies", () => {
    expect(workflow).toMatch(/npx cap sync android/);
    expect(workflow).toMatch(/npx cap sync ios/);
    expect(existsSync(capacitor.webDir)).toBe(true);
  });
});

describe("the workflow does not pretend to have run", () => {
  it("states plainly that it is prepared but unverified", () => {
    expect(workflow).toMatch(/PREPARED, NOT YET VERIFIED/);
  });

  it("is manually dispatched rather than wired into push CI", () => {
    // Unvalidated jobs on every push would turn the main pipeline red on config
    // rather than code, and a pipeline people ignore is worse than none.
    expect(workflow).toMatch(/workflow_dispatch:/);
    expect(workflow).not.toMatch(/^on:\s*\n\s*push:/m);
  });

  it("explains why it is separate from ci.yml", () => {
    expect(workflow).toMatch(/WHY THIS IS A SEPARATE WORKFLOW/);
  });
});

describe("signing and release stay under human control", () => {
  it("builds iOS for the simulator without a signing identity", () => {
    expect(workflow).toMatch(/CODE_SIGNING_ALLOWED=NO/);
    expect(workflow).toMatch(/-sdk iphonesimulator/);
  });

  it("labels the Windows companion artifact as unsigned", () => {
    expect(workflow).toMatch(/unsigned/i);
  });

  it("never signs, publishes or deploys", () => {
    expect(workflow).not.toMatch(/codesign|notarytool|npm publish|wrangler deploy/);
    expect(workflow).not.toMatch(/TAURI_SIGNING_PRIVATE_KEY/);
  });

  it("embeds no credential-shaped literal", () => {
    expect(workflow).not.toMatch(/sk-[A-Za-z0-9_-]{20,}/);
    expect(workflow).not.toMatch(/AKIA[0-9A-Z]{16}/);
  });
});

describe("the Rust safety assertions run on a runner that can link them", () => {
  it("uses a windows runner for the desktop job", () => {
    const desktop = workflow.slice(workflow.indexOf("  desktop-windows:"));
    expect(desktop).toMatch(/runs-on:\s*windows-latest/);
  });

  it("runs cargo test, not merely cargo build", () => {
    const desktop = workflow.slice(workflow.indexOf("  desktop-windows:"));
    expect(desktop).toMatch(/cargo test --all-targets/);
  });
});
