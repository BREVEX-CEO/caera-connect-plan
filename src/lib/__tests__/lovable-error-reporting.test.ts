import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { reportLovableError } from "../lovable-error-reporting";

/**
 * Editor error reporting.
 *
 * The property that matters most: a raw `Response` (loaders and server
 * functions commonly throw one) must NOT be stringified to the opaque
 * "[object Response]". A report that says nothing is indistinguishable from no
 * report at all, and this is exactly the case that reaches the editor most
 * often.
 *
 * Also pinned: the module is a no-op on the server, and it never throws when
 * the editor hooks are absent — error reporting must not itself become the
 * error.
 */

interface Captured {
  error: unknown;
  context?: Record<string, unknown>;
  options?: Record<string, unknown>;
}

const captured: Captured[] = [];
const runtimeReports: Array<{ message: string; stack?: string; filename?: string }> = [];

function installWindow(options: { withHooks: boolean }) {
  const win: Record<string, unknown> = { location: { pathname: "/ocade/studio" } };
  if (options.withHooks) {
    win.__lovableEvents = {
      captureException: (error: unknown, context?: never, opts?: never) =>
        captured.push({ error, context, options: opts }),
    };
    win.__lovableReportRuntimeError = (payload: never) => runtimeReports.push(payload);
  }
  vi.stubGlobal("window", win);
}

beforeEach(() => {
  captured.length = 0;
  runtimeReports.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("server safety", () => {
  it("does nothing when there is no window (SSR)", () => {
    vi.stubGlobal("window", undefined);
    expect(() => reportLovableError(new Error("boom"))).not.toThrow();
    expect(captured).toHaveLength(0);
  });
});

describe("reporting through the editor hooks", () => {
  beforeEach(() => installWindow({ withHooks: true }));

  it("forwards the error with route and source context", () => {
    const boom = new Error("boom");
    reportLovableError(boom);

    expect(captured).toHaveLength(1);
    expect(captured[0].error).toBe(boom);
    expect(captured[0].context).toMatchObject({
      source: "react_error_boundary",
      route: "/ocade/studio",
    });
  });

  it("marks the error as unhandled at error severity", () => {
    reportLovableError(new Error("boom"));
    expect(captured[0].options).toMatchObject({
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    });
  });

  it("lets the caller add context without losing the defaults", () => {
    reportLovableError(new Error("boom"), { conversationId: "c1" });
    expect(captured[0].context).toMatchObject({
      source: "react_error_boundary",
      route: "/ocade/studio",
      conversationId: "c1",
    });
  });

  it("allows the caller to override a default context field", () => {
    reportLovableError(new Error("boom"), { source: "manual" });
    expect(captured[0].context?.source).toBe("manual");
  });
});

describe("message extraction never reports an opaque value", () => {
  beforeEach(() => installWindow({ withHooks: true }));

  it("describes a thrown Response by status and url, not [object Response]", () => {
    const response = new Response("nope", { status: 503 });
    Object.defineProperty(response, "url", { value: "https://example.test/api" });

    reportLovableError(response);

    expect(runtimeReports).toHaveLength(1);
    expect(runtimeReports[0].message).toBe("Response 503 at https://example.test/api");
    expect(runtimeReports[0].message).not.toContain("[object");
  });

  it("describes a Response with no url by status alone", () => {
    reportLovableError(new Response("nope", { status: 500 }));
    expect(runtimeReports[0].message).toBe("Response 500");
  });

  it("uses the message and stack of a real Error", () => {
    const boom = new Error("kaboom");
    reportLovableError(boom);
    expect(runtimeReports[0].message).toBe("kaboom");
    expect(runtimeReports[0].stack).toBe(boom.stack);
  });

  it("stringifies a non-Error throw and sends no stack", () => {
    reportLovableError("just a string");
    expect(runtimeReports[0].message).toBe("just a string");
    expect(runtimeReports[0].stack).toBeUndefined();
  });

  it("records the route as the filename", () => {
    reportLovableError(new Error("boom"));
    expect(runtimeReports[0].filename).toBe("/ocade/studio");
  });
});

describe("missing editor hooks", () => {
  beforeEach(() => installWindow({ withHooks: false }));

  it("does not throw when the editor hooks are absent (production)", () => {
    expect(() => reportLovableError(new Error("boom"))).not.toThrow();
    expect(captured).toHaveLength(0);
    expect(runtimeReports).toHaveLength(0);
  });

  it("does not throw for a Response either", () => {
    expect(() => reportLovableError(new Response("x", { status: 500 }))).not.toThrow();
  });
});
