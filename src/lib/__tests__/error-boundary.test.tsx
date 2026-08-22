// @vitest-environment jsdom
/**
 * THE LAST THING BETWEEN A CRASH AND THE USER'S SCREEN.
 *
 * The boundary catches a panel that throws and puts something in its place.
 * What it puts there matters: React gives it the raw `Error`, and a raw error
 * message is written for whoever wrote the code — "Cannot read properties of
 * undefined (reading 'name')" tells a person nothing they can act on and tells
 * them the product is broken in a way that feels unsafe.
 *
 * This had no tests at all, which is how it came to render `error.message`
 * directly.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "@/components/shell/ErrorBoundary";

/** A component that throws on demand. */
function Boom({ throwWith }: { throwWith: Error | null }) {
  if (throwWith) throw throwWith;
  return <p>working fine</p>;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** React logs caught errors; silence it so the output stays readable. */
function quietly(run: () => void) {
  const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  run();
  spy.mockRestore();
}

describe("a panel that works is left alone", () => {
  it("renders its children untouched", () => {
    render(
      <ErrorBoundary label="Chat">
        <Boom throwWith={null} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("working fine")).toBeTruthy();
  });
});

describe("a panel that throws is replaced with something a person can read", () => {
  it("says which panel stopped, and offers a way back", () => {
    quietly(() =>
      render(
        <ErrorBoundary label="Chat">
          <Boom throwWith={new Error("the engine went away")} />
        </ErrorBoundary>,
      ),
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/Chat stopped working/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy();
  });

  it("keeps a plain-language message from the product", () => {
    // A message written FOR a person should survive. Replacing everything
    // would throw away the useful ones with the useless ones.
    quietly(() =>
      render(
        <ErrorBoundary label="Files">
          <Boom throwWith={new Error("That folder is no longer on this computer.")} />
        </ErrorBoundary>,
      ),
    );
    expect(screen.getByText(/no longer on this computer/i)).toBeTruthy();
  });
});

describe("a raw developer error never reaches the screen", () => {
  const DEVELOPER_ERRORS = [
    new TypeError("Cannot read properties of undefined (reading 'name')"),
    new TypeError("x.map is not a function"),
    new ReferenceError("engine is not defined"),
    new SyntaxError("Unexpected token < in JSON at position 0"),
    Object.assign(new Error("Minified React error #310; visit https://react.dev/errors/310"), {}),
    new Error(
      "TypeError: fetch failed\n    at node:internal/deps/undici (/app/dist/chunk-A1B2.js:99:13)",
    ),
  ];

  for (const error of DEVELOPER_ERRORS) {
    it(`hides: ${error.message.slice(0, 44)}`, () => {
      quietly(() =>
        render(
          <ErrorBoundary label="Chat">
            <Boom throwWith={error} />
          </ErrorBoundary>,
        ),
      );
      const shown = screen.getByRole("alert").textContent ?? "";
      // The panel still explains itself and still offers recovery...
      expect(shown).toMatch(/stopped working/i);
      expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy();
      // ...but not by quoting the machine at the person.
      expect(shown).not.toContain("undefined");
      expect(shown).not.toContain("is not a function");
      expect(shown).not.toContain("is not defined");
      expect(shown).not.toContain("Unexpected token");
      expect(shown).not.toMatch(/React error #\d+/);
      expect(shown).not.toMatch(/\.js:\d+:\d+/);
      expect(shown).not.toMatch(/\bat\s+\S+\s*\(/);
    });
  }

  it("still says something rather than going blank", () => {
    quietly(() =>
      render(
        <ErrorBoundary>
          <Boom throwWith={new TypeError("undefined is not an object")} />
        </ErrorBoundary>,
      ),
    );
    expect((screen.getByRole("alert").textContent ?? "").trim().length).toBeGreaterThan(20);
  });
});

describe("Try again gives the panel another chance", () => {
  it("re-renders the children after the fault is cleared", () => {
    let boom: Error | null = new Error("temporary");
    function Flaky() {
      if (boom) throw boom;
      return <p>recovered</p>;
    }
    quietly(() =>
      render(
        <ErrorBoundary label="Chat">
          <Flaky />
        </ErrorBoundary>,
      ),
    );
    expect(screen.queryByText("recovered")).toBeNull();
    boom = null;
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(screen.getByText("recovered")).toBeTruthy();
  });
});
