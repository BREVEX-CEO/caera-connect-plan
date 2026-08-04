import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * `useLocalEngine` — the first paint must never claim a local engine exists.
 *
 * SCOPE, STATED HONESTLY: "node" environment + `renderToStaticMarkup`, so the
 * component renders but effects do not run. This proves the INITIAL state only
 * — which is precisely the state that ships from the server and appears before
 * any probe has happened.
 *
 * That is the honesty property worth pinning: a surface must not render "local
 * engine ready" before a read probe has actually reached the runtime. The rule
 * throughout this project is never to report a capability without evidence, and
 * an optimistic initial state would break it on every page load. The probe
 * itself (network discovery, caching, refresh) needs a DOM and a live bridge and
 * is NOT claimed as covered here.
 */

// The discovery call must never fire during render; if it does, this throws and
// the test fails rather than quietly reaching the network.
vi.mock("../ocade-local", () => ({
  DEFAULT_LOCAL_BRIDGE_URL: "http://127.0.0.1:11434",
  discoverLocalModels: vi.fn(() => {
    throw new Error("discoverLocalModels must not be called during render");
  }),
}));

const { useLocalEngine } = await import("../use-local-engine");

function Probe() {
  const engine = useLocalEngine();
  return (
    <span data-status={engine.status} data-reachable={String(engine.reachable)}>
      {engine.models.length} models
    </span>
  );
}

const render = () => renderToStaticMarkup(<Probe />);

describe("initial engine state", () => {
  it("starts idle — never 'ready' before a probe", () => {
    expect(render()).toContain('data-status="idle"');
    expect(render()).not.toContain('data-status="ready"');
  });

  it("does not claim the engine is reachable", () => {
    expect(render()).toContain('data-reachable="false"');
  });

  it("reports no models rather than an optimistic guess", () => {
    expect(render()).toContain("0 models");
  });

  it("renders without reaching the network", () => {
    // The mock throws if discovery is called during render.
    expect(() => render()).not.toThrow();
  });

  it("is SSR-safe with no window or navigator present", () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("navigator", undefined);
    expect(() => render()).not.toThrow();
    expect(render()).toContain('data-status="idle"');
    vi.unstubAllGlobals();
  });

  it("exposes a refresh function so the surface can re-probe on demand", () => {
    function RefreshProbe() {
      const engine = useLocalEngine();
      return <span data-has-refresh={String(typeof engine.refresh === "function")} />;
    }
    expect(renderToStaticMarkup(<RefreshProbe />)).toContain('data-has-refresh="true"');
  });

  it("stays idle when explicitly disabled", () => {
    function DisabledProbe() {
      const engine = useLocalEngine("http://127.0.0.1:11434", false);
      return <span data-status={engine.status} />;
    }
    expect(renderToStaticMarkup(<DisabledProbe />)).toContain('data-status="idle"');
  });
});
