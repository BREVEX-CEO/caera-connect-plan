import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("packaged hand-control integration", () => {
  const main = read("native/companion/tauri/src/main.rs");
  const supervisor = read("native/companion/tauri/src/gesture_host.rs");
  const client = read("src/lib/native/tauri-companion.ts");
  const panel = read("src/components/settings/GestureControlPanel.tsx");
  const config = read("native/companion/tauri/tauri.conf.json");
  const overlay = read("native/companion/ui/overlay.js");
  const overlayHtml = read("native/companion/ui/index.html");

  it("ships the gesture process as a real Tauri sidecar", () => {
    expect(config).toContain("binaries/ocade-gesture-host");
    expect(supervisor).toContain("Command::new(executable)");
    expect(supervisor).toContain('arg("--enable-control")');
    expect(supervisor).toContain("child.kill()");
  });

  it("requires a signed session before cursor control starts", () => {
    expect(main).toContain('verify_signed(&state, &request, "gesture_start"');
    expect(client).toContain('this.session.sign("gesture_start", args)');
    expect(main).toContain("state.emergency.is_halted()");
  });

  it("stops the gesture process through the universal emergency stop", () => {
    const emergency = main.slice(main.indexOf("fn emergency_stop"));
    expect(emergency).toContain("state.gesture.stop()");
    expect(main.match(/gesture\.stop\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it("uses a visible two-step activation instead of arming on page load", () => {
    expect(panel).toContain("Activate cursor");
    expect(panel).toContain("Allow hand control?");
    expect(panel).toContain("setConfirming(true)");
    expect(panel).toContain("start(true)");
    expect(panel).toContain("Delete:</strong> intentionally not mapped");
    expect(overlayHtml).toContain("Activate cursor");
    expect(overlayHtml).toContain("Yes, allow control");
    expect(overlay).toContain('signed("gesture_start", args)');
  });

  it("boots the installed companion from bundled files without a developer server", () => {
    expect(config).not.toContain("localhost:3000");
    expect(config).not.toContain('"label": "main"');
    expect(config).toContain('"label": "overlay"');
    expect(config).toContain('"visible": true');
  });
});
