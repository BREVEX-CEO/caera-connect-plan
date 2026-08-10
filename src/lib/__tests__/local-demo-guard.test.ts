import { describe, expect, it } from "vitest";
import { decideDemoControl, isLoopbackOrigin } from "@/lib/agent/local-demo-guard";

/**
 * These tests are mostly about the NOs.
 *
 * Demo Control + Work removes the account requirement from a surface that
 * operates a real computer. The yes-case is one line; every dangerous shape is
 * a no, and each one is pinned here so a later convenience cannot quietly
 * widen it.
 */

describe("only this machine, served to itself", () => {
  it("accepts the loopback origins the desktop shell actually uses", () => {
    for (const origin of ["http://127.0.0.1:57917", "http://localhost:3000", "https://localhost"]) {
      expect(isLoopbackOrigin(origin), origin).toBe(true);
    }
  });

  it("rejects every routable origin", () => {
    for (const origin of [
      "https://ocade.example.com",
      "http://192.168.1.20:3000",
      "http://10.0.0.5",
      "http://127.0.0.1.evil.com",
      "https://localhost.attacker.net",
      "file:///C:/ocade/index.html",
      "",
      null,
      undefined,
    ]) {
      expect(isLoopbackOrigin(origin as string | null), String(origin)).toBe(false);
    }
  });
});

describe("demo control refuses unless it is genuinely local", () => {
  it("allows the desktop shell on loopback", () => {
    const decision = decideDemoControl({ isDesktopApp: true, origin: "http://127.0.0.1:57917" });
    expect(decision.allowed).toBe(true);
  });

  it("refuses an ordinary browser, even on loopback", () => {
    // A developer running `vite dev` is on loopback but has no companion, and
    // an unauthenticated page that claims computer control is exactly the shape
    // this gate exists to prevent.
    const decision = decideDemoControl({ isDesktopApp: false, origin: "http://localhost:5173" });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("not_desktop_app");
    expect(decision.explain).toMatch(/desktop application/i);
  });

  it("refuses a hosted deployment outright, desktop shell or not", () => {
    for (const isDesktopApp of [true, false]) {
      const decision = decideDemoControl({ isDesktopApp, origin: "https://ocade.example.com" });
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe("not_loopback");
    }
  });

  it("refuses on the server, where there is no computer to reach", () => {
    expect(decideDemoControl({ origin: null }).allowed).toBe(false);
  });

  it("always explains itself in a sentence", () => {
    for (const origin of ["https://example.com", "http://localhost:1", null]) {
      const decision = decideDemoControl({ isDesktopApp: false, origin });
      expect(decision.explain.length).toBeGreaterThan(30);
    }
  });
});
