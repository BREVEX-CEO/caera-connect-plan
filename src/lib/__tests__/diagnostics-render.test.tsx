import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DiagnosticsPanel } from "@/components/ocade/DiagnosticsPanel";

/**
 * RENDER PROOF for the error-healing surface (§11), which de-orphans
 * `healing/playbooks` by giving it a real §0.2 consumer.
 *
 * The engine is proven by healing-playbooks.test.ts; this proves the surface
 * exposing it is honest and reachable before anything runs.
 */

const html = () => renderToStaticMarkup(<DiagnosticsPanel />);

describe("the diagnostics panel", () => {
  it("mounts without throwing", () => {
    expect(() => html()).not.toThrow();
  });

  it("has a labelled input, not a placeholder-only field", () => {
    const out = html();
    expect(out).toContain('for="diag-input"');
    expect(out).toContain('id="diag-input"');
  });

  it("starts with a real sample error, not an empty box", () => {
    expect(html()).toContain("Cannot find module");
  });

  it("states its two honesty rules up front", () => {
    const out = html();
    expect(out).toMatch(/least-invasive fix first/i);
    expect(out).toMatch(/weak signal is shown as a guess/i);
    expect(out).toMatch(/how it undoes|how it.{0,4}s verified/i);
  });

  it("offers a real Diagnose button", () => {
    expect(html()).toMatch(/<button[\s\S]*?Diagnose/);
  });

  it("shows no result region before the user runs it", () => {
    expect(html()).not.toContain('role="status"');
  });
});
