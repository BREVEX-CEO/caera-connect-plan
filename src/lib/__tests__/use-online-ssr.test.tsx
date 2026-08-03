import { describe, it, expect, afterEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { useOnline } from "../use-online";

/**
 * `useOnline` — SSR-safe initial state.
 *
 * SCOPE, STATED HONESTLY: this suite runs in the "node" environment and uses
 * `renderToStaticMarkup`, which executes a component's render but NOT its
 * effects. It therefore proves the `useState` INITIALISER — the branch that
 * decides what the very first paint shows — and nothing about the
 * online/offline event listeners.
 *
 * That initialiser is the part worth pinning anyway, because it is the one that
 * runs on the server. If it returned `false` when `navigator` is absent, every
 * server-rendered page would ship an "offline" banner and then flip to online on
 * hydration — a visible wrong-state flash on every single load. Assuming ONLINE
 * when the runtime cannot tell us is the correct default.
 *
 * The event-driven updates (`online`/`offline` firing `setOnline`) require a DOM
 * and an effect runtime. This repository has no jsdom/happy-dom dependency and
 * adding one is out of scope here, so that half is NOT claimed as covered.
 */

function Probe() {
  const online = useOnline();
  return <span data-online={String(online)}>{online ? "online" : "offline"}</span>;
}

const render = () => renderToStaticMarkup(<Probe />);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("initial state on the server (no navigator)", () => {
  it("assumes ONLINE so SSR never ships a false offline banner", () => {
    vi.stubGlobal("navigator", undefined);
    expect(render()).toContain("online");
    expect(render()).not.toContain("offline");
  });
});

describe("initial state in a browser-like runtime", () => {
  it("reflects navigator.onLine === true", () => {
    vi.stubGlobal("navigator", { onLine: true });
    expect(render()).toContain('data-online="true"');
  });

  it("reflects navigator.onLine === false on the very first paint", () => {
    // A user who loads the app while offline must see the offline state
    // immediately, not after an effect has run.
    vi.stubGlobal("navigator", { onLine: false });
    expect(render()).toContain('data-online="false"');
    expect(render()).toContain("offline");
  });

  it("renders without throwing when navigator lacks onLine entirely", () => {
    vi.stubGlobal("navigator", {});
    expect(() => render()).not.toThrow();
  });
});

describe("render safety", () => {
  it("does not require window during render, so SSR cannot crash on it", () => {
    // The listeners live in an effect; render itself must not touch `window`.
    vi.stubGlobal("navigator", undefined);
    vi.stubGlobal("window", undefined);
    expect(() => render()).not.toThrow();
  });

  it("is deterministic for a given navigator state", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(render()).toBe(render());
  });
});
