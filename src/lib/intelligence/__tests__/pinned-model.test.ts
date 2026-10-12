import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_ONLINE_MODEL, ONLINE_MODEL_CATALOG, isAllowedOnlineModel } from "../online-models";

/**
 * One pinned online model, held in server configuration and the allowlist.
 * Provider identity stays out of public documentation (AGENTS.md), so the
 * pin is asserted here rather than against a document.
 */

const EDGE_FUNCTION = readFileSync("supabase/functions/_shared/boundary.ts", "utf8");

describe("the pinned online model", () => {
  it("is one exact identifier", () => {
    expect(DEFAULT_ONLINE_MODEL).toBe("gemini-3.8-flash");
  });

  it("is the only model the allowlist accepts", () => {
    expect(ONLINE_MODEL_CATALOG).toHaveLength(1);
    expect(isAllowedOnlineModel(DEFAULT_ONLINE_MODEL)).toBe(true);
    // A client-chosen model, a provider alias and the identifier this replaced
    // are all refused, so a mistyped override fails closed rather than reaching
    // something nobody chose.
    expect(isAllowedOnlineModel("latest")).toBe(false);
    expect(isAllowedOnlineModel("gemini-3.7-flash")).toBe(false);
    // No weaker fallback (owner, 13 Oct 2026), and no paid Pro by accident.
    expect(isAllowedOnlineModel("gemini-3.1-flash-lite")).toBe(false);
    expect(isAllowedOnlineModel("gemini-3.1-pro-preview")).toBe(false);
    expect(isAllowedOnlineModel("gemini-1.5-pro")).toBe(false);
  });

  it("is the Edge Function's default rather than a second literal", () => {
    // The function used to carry its own `"gemini-3.7-flash"` string, which is
    // how the two came apart in the first place.
    expect(EDGE_FUNCTION).toContain("DEFAULT_ONLINE_MODEL");
    expect(EDGE_FUNCTION).not.toMatch(/"gemini-[\d.]+/);
  });
});
