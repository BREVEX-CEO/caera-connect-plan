import { describe, it, expect } from "vitest";
import {
  resolveDeviceMode,
  preferenceFor,
  ADAPTER_PREFERENCE,
  type DeviceMode,
} from "../brain/device-mode";
import { routeBrain, explainRoute } from "../brain/router";
import {
  unavailable,
  type AdapterAvailability,
  type AdapterId,
  type BrainAdapter,
  type BrainStreamResult,
} from "../brain/adapter";

/**
 * The routing rules decide whether a person's conversation stays on their
 * machine, so they are tested as rules rather than exercised incidentally.
 *
 * The most important assertion in this file is the negative one: when nothing
 * local can serve and cloud is off, OCADE refuses. A local-first product that
 * quietly reaches for the cloud under pressure is a cloud product.
 */

function fakeAdapter(
  id: AdapterId,
  availability: AdapterAvailability,
  streamResult: BrainStreamResult = { ok: true, modelId: "fake", firstTokenMs: 1 },
): BrainAdapter {
  return {
    id,
    displayName: id,
    probe: async () => availability,
    stream: async () => streamResult,
  };
}

const ready = (label: string, vision = false): AdapterAvailability => ({
  available: true,
  label,
  locality: "on_device",
  modelId: "fake-model",
  capabilities: { text: true, vision, imageGeneration: false, tools: true },
});

const registry = (...adapters: BrainAdapter[]) =>
  new Map<AdapterId, BrainAdapter>(adapters.map((a) => [a.id, a]));

describe("device mode is decided from real signals", () => {
  const base = {
    isDesktopApp: false,
    isMobileApp: false,
    isMobileBrowser: false,
    hasPairedDesktop: false,
  };

  it("treats the desktop app as a desktop app even when a computer is paired", () => {
    // Its own engine is right there; crossing the network would be absurd.
    expect(resolveDeviceMode({ ...base, isDesktopApp: true, hasPairedDesktop: true })).toBe(
      "desktop_app",
    );
  });

  it("separates a paired browser from a bare one", () => {
    expect(resolveDeviceMode({ ...base, hasPairedDesktop: true })).toBe("pc_web_paired");
    expect(resolveDeviceMode(base)).toBe("pc_web");
  });

  it("recognises the mobile app and the mobile browser separately", () => {
    expect(resolveDeviceMode({ ...base, isMobileApp: true })).toBe("mobile_app");
    expect(resolveDeviceMode({ ...base, isMobileBrowser: true })).toBe("mobile_web");
  });
});

describe("engine preference per device", () => {
  it("never offers cloud as a fallback in any mode", () => {
    // Cloud is an explicit user decision, not a place routing lands.
    for (const mode of Object.keys(ADAPTER_PREFERENCE) as DeviceMode[]) {
      expect(ADAPTER_PREFERENCE[mode]).not.toContain("cloud");
    }
  });

  it("prefers WebGPU over WebAssembly in every browser mode", () => {
    for (const mode of ["pc_web", "pc_web_paired", "mobile_web"] as DeviceMode[]) {
      const order = ADAPTER_PREFERENCE[mode];
      expect(order.indexOf("browser_webgpu")).toBeLessThan(order.indexOf("browser_wasm"));
    }
  });

  it("sends heavy work from a phone to a paired computer first", () => {
    expect(preferenceFor("mobile_app", true)[0]).toBe("paired_desktop");
  });

  it("answers light work on the phone itself, leaving the laptop alone", () => {
    expect(preferenceFor("mobile_app", false)[0]).toBe("mobile_native");
  });

  it("keeps browser engines behind a paired desktop, so unplugging degrades", () => {
    expect(ADAPTER_PREFERENCE.pc_web_paired).toEqual([
      "paired_desktop",
      "browser_webgpu",
      "browser_wasm",
    ]);
  });

  /*
   * EVERY MODE MUST END SOMEWHERE IT CAN ACTUALLY RUN.
   *
   * `desktop_app` used to list only `desktop_bridge` and `mobile_app` only
   * `paired_desktop` and `mobile_native`. Both looked reasonable and both left
   * a real user with nothing: a desktop whose engine has not been started, and
   * a phone with no pairing, each had an empty set of reachable adapters and a
   * permanently disabled composer — inside a webview that could have answered.
   *
   * This asserts the property rather than the literal lists, so a mode added
   * later cannot reintroduce the same dead end.
   */
  it("gives every device mode an engine it can reach without a network", () => {
    for (const mode of Object.keys(ADAPTER_PREFERENCE) as DeviceMode[]) {
      const order = ADAPTER_PREFERENCE[mode];
      expect(order.includes("browser_webgpu") || order.includes("browser_wasm")).toBe(true);
    }
  });

  it("never puts a browser engine ahead of a device's own engine", () => {
    // The fallback must not become the default: a real local engine is faster
    // and larger than anything a browser can hold.
    for (const [mode, native] of [
      ["desktop_app", "desktop_bridge"],
      ["mobile_app", "paired_desktop"],
    ] as const) {
      const order = ADAPTER_PREFERENCE[mode];
      expect(order.indexOf(native)).toBeLessThan(order.indexOf("browser_webgpu"));
    }
  });

  it("leaves a phone doing light work a fallback after its own engine", () => {
    // `mobile_native` is not registered in this build, so without the tail a
    // phone on light work resolves to nothing at all.
    const order = preferenceFor("mobile_app", false);
    expect(order[0]).toBe("mobile_native");
    expect(order).toContain("browser_wasm");
  });
});

describe("routing picks the first available engine", () => {
  it("takes the preferred engine when it is ready", async () => {
    const outcome = await routeBrain({
      mode: "pc_web",
      adapters: registry(
        fakeAdapter("browser_webgpu", ready("OCADE Browser")),
        fakeAdapter("browser_wasm", ready("OCADE Browser (compatibility)")),
      ),
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.adapter.id).toBe("browser_webgpu");
  });

  it("falls through to WebAssembly when WebGPU is absent, recording why", async () => {
    const outcome = await routeBrain({
      mode: "pc_web",
      adapters: registry(
        fakeAdapter(
          "browser_webgpu",
          unavailable("unsupported_device", "This browser has no WebGPU."),
        ),
        fakeAdapter("browser_wasm", ready("OCADE Browser (compatibility)")),
      ),
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.adapter.id).toBe("browser_wasm");
      expect(outcome.attempts[0].availability.available).toBe(false);
    }
  });

  it("skips a ready engine that cannot see images when vision is required", async () => {
    const outcome = await routeBrain({
      mode: "pc_web",
      visionRequired: true,
      adapters: registry(
        fakeAdapter("browser_webgpu", ready("OCADE Browser", false)),
        fakeAdapter("browser_wasm", ready("OCADE Browser Vision", true)),
      ),
    });
    expect(outcome.ok).toBe(true);
    // Handing an image to a text-only model yields confident nonsense.
    if (outcome.ok) expect(outcome.adapter.id).toBe("browser_wasm");
  });

  it("treats a throwing probe as unavailable rather than aborting the route", async () => {
    const broken: BrainAdapter = {
      id: "browser_webgpu",
      displayName: "broken",
      probe: async () => {
        throw new Error("adapter exploded");
      },
      stream: async () => ({ ok: false, failure: "error", reason: "n/a" }),
    };
    const outcome = await routeBrain({
      mode: "pc_web",
      adapters: registry(broken, fakeAdapter("browser_wasm", ready("OCADE Browser"))),
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.adapter.id).toBe("browser_wasm");
      const first = outcome.attempts[0].availability;
      expect(first.available).toBe(false);
      if (!first.available) expect(first.code).toBe("probe_failed");
    }
  });
});

describe("refusing honestly is the point", () => {
  it("refuses rather than answering when nothing is available", async () => {
    const outcome = await routeBrain({
      mode: "pc_web",
      adapters: registry(
        fakeAdapter("browser_webgpu", unavailable("unsupported_device", "No WebGPU.")),
        fakeAdapter("browser_wasm", unavailable("insufficient_memory", "Not enough memory.")),
      ),
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toMatch(/has not answered/i);
      // The promise, stated in the refusal itself.
      expect(outcome.reason).toMatch(/without being told to/i);
    }
  });

  it("offers actions the user can actually take", async () => {
    const outcome = await routeBrain({
      mode: "pc_web",
      adapters: registry(
        fakeAdapter("browser_webgpu", unavailable("unsupported_device", "No WebGPU.")),
      ),
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.remedies).toContain("install_ocade");
      expect(outcome.remedies).toContain("pair_a_computer");
    }
  });

  it("does not offer to install the desktop app to someone already in it", async () => {
    const outcome = await routeBrain({
      mode: "desktop_app",
      adapters: registry(
        fakeAdapter("desktop_bridge", unavailable("not_running", "Engine stopped.")),
      ),
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.remedies).not.toContain("install_ocade");
      expect(outcome.remedies).toContain("start_engine");
    }
  });

  /*
   * The failure that produced the fallback, reproduced exactly.
   *
   * Observed in the running demo: the bridge was not up, the route refused, and
   * the composer went read-only with "This browser cannot run an on-device
   * engine" — on a machine where `BrowserWebGpuAdapter.probe()` returned
   * `available: true` when called by hand a second later.
   */
  it("falls back to a browser engine when the desktop bridge is not running", async () => {
    const outcome = await routeBrain({
      mode: "desktop_app",
      adapters: registry(
        fakeAdapter("desktop_bridge", unavailable("not_running", "Engine stopped.")),
        fakeAdapter("browser_webgpu", ready("OCADE Browser")),
      ),
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.availability.locality).toBe("on_device");
      // The failed bridge is still reported, so the fallback is visible rather
      // than silent — the user should know why they are on the slower engine.
      expect(outcome.attempts[0]?.id).toBe("desktop_bridge");
    }
  });

  it("still prefers the desktop bridge whenever it is actually running", async () => {
    const outcome = await routeBrain({
      mode: "desktop_app",
      adapters: registry(
        fakeAdapter("desktop_bridge", ready("OCADE Engine")),
        fakeAdapter("browser_webgpu", ready("OCADE Browser")),
      ),
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.adapter.id).toBe("desktop_bridge");
  });

  it("does not repeat a remedy suggested by several engines", async () => {
    const outcome = await routeBrain({
      mode: "pc_web",
      adapters: registry(
        fakeAdapter("browser_webgpu", unavailable("no_model", "No model.", ["download_model"])),
        fakeAdapter("browser_wasm", unavailable("no_model", "No model.", ["download_model"])),
      ),
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.remedies.filter((r) => r === "download_model")).toHaveLength(1);
    }
  });

  it("says when cloud would help, without switching it on", async () => {
    const outcome = await routeBrain({
      mode: "pc_web",
      cloudEnabled: false,
      adapters: registry(fakeAdapter("browser_webgpu", unavailable("unsupported_device", "No."))),
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.cloudWouldHelp).toBe(true);
  });

  it("refuses when the registry is empty rather than throwing", async () => {
    const outcome = await routeBrain({ mode: "mobile_web", adapters: new Map() });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.attempts).toHaveLength(0);
  });
});

describe("route explanations read like sentences", () => {
  it("names the engine that answered", async () => {
    const outcome = await routeBrain({
      mode: "pc_web",
      adapters: registry(fakeAdapter("browser_webgpu", ready("OCADE Browser"))),
    });
    expect(explainRoute(outcome)).toBe("OCADE Browser answered.");
  });

  it("counts the engines it had to pass over", async () => {
    const outcome = await routeBrain({
      mode: "pc_web",
      adapters: registry(
        fakeAdapter("browser_webgpu", unavailable("unsupported_device", "No WebGPU.")),
        fakeAdapter("browser_wasm", ready("OCADE Browser")),
      ),
    });
    expect(explainRoute(outcome)).toMatch(/after 1 unavailable engine\./);
  });
});
