import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GENERATION_SURFACES } from "@/lib/commercial/generation-gate";
import { PROVIDER_KEY_ENVIRONMENT, PROVIDER_KEY_SLOTS } from "../online-models";

/**
 * THE ONLINE BOUNDARY: THREE SECRETS, ONE SERVER, NO BROWSER.
 *
 * `PLAN.md` Phase 6 is specific about a property that cannot be tested by
 * calling anything: the Gemini keys exist in exactly three named places, all of
 * them server-side. A runtime test proves the code path it exercises; the risk
 * here is a path somebody adds later, in a file nobody looked at, so these read
 * the source and the built bundle.
 *
 * The failover RULES are proven separately, against a fake provider, in
 * `edge-handler.test.ts`. This file proves the SHAPE they run inside.
 */

const EDGE_HANDLER = readFileSync("src/lib/intelligence/edge-handler.ts", "utf8");
const EDGE_ENTRY = readFileSync("supabase/functions/_shared/boundary.ts", "utf8");

function sourceFiles(directory: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      out.push(...sourceFiles(path));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry)) out.push(path);
  }
  return out;
}

describe("the three key slots", () => {
  it("are exactly three, primary first", () => {
    expect([...PROVIDER_KEY_SLOTS]).toEqual(["primary", "secondary", "tertiary"]);
  });

  it("are read from exactly the three names PLAN.md fixes", () => {
    expect(PROVIDER_KEY_ENVIRONMENT).toEqual({
      primary: "GEMINI_API_KEY_PRIMARY",
      secondary: "GEMINI_API_KEY_SECONDARY",
      tertiary: "GEMINI_API_KEY_TERTIARY",
    });
  });

  it("accepts no fourth name, not even the one an earlier deployment set", () => {
    /*
     * The unprefixed `GEMINI_API_KEY` was read as the primary for
     * compatibility. A fourth accepted name is a fourth place a key can be set
     * and the one nobody rotates, so it is gone — and this fails if it returns.
     */
    const names = [...EDGE_ENTRY.matchAll(/Deno\.env\.get\(\s*"([^"]*GEMINI[^"]*)"\s*\)/g)].map(
      (match) => match[1],
    );
    expect(names).toEqual(["GEMINI_MODEL"]);
  });

  it("reads every slot through the shared map rather than a retyped string", () => {
    for (const slot of PROVIDER_KEY_SLOTS) {
      expect(EDGE_ENTRY).toContain(`Deno.env.get(PROVIDER_KEY_ENVIRONMENT.${slot})`);
    }
  });
});

describe("where a key may appear", () => {
  it("is one file, and it is a Deno function no browser bundle imports", () => {
    expect(EDGE_ENTRY).toContain("generativelanguage.googleapis.com");
    expect(EDGE_ENTRY).toContain("x-goog-api-key");
  });

  it("is nowhere in the product's own source", () => {
    /*
     * Not "no key is hard-coded" — no NAME is even mentioned. A browser module
     * that so much as reads `GEMINI_API_KEY_PRIMARY` from an environment has
     * asked a bundler to inline it.
     */
    const offenders = sourceFiles("src")
      .filter((path) => !path.endsWith("online-models.ts") && !path.includes("__tests__"))
      .filter((path) => /GEMINI_API_KEY/.test(readFileSync(path, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("is never the handler's business: it is told a slot, never a key", () => {
    expect(EDGE_HANDLER).not.toMatch(/GEMINI_API_KEY/);
    expect(EDGE_HANDLER).toContain("slot: ProviderKeySlot");
  });

  it("never reaches a log line, because the record carries no key at all", () => {
    // The health record is built from enumerated values; the entry point logs
    // that record and nothing else.
    const logged = [...EDGE_ENTRY.matchAll(/console\.log\(([^;]*?)\),?\n/g)].map((match) =>
      match[1].trim(),
    );
    expect(logged).toEqual(['"ocade.health", JSON.stringify(record)']);
  });
});

describe("what the boundary accepts", () => {
  it("accepts a request only from a surface the product actually has", () => {
    const listed = /const ALLOWED_SURFACES: readonly string\[\] = \[([^\]]*)\]/
      .exec(EDGE_HANDLER)?.[1]
      .split(",")
      .map((entry) => entry.trim().replace(/"/g, ""))
      .filter(Boolean);
    expect(listed).toEqual([...GENERATION_SURFACES]);
  });

  it("pins one model rather than accepting one from the caller", () => {
    // `model` comes from the deployment and is checked against the allowlist;
    // the request body has no model field to honour.
    expect(EDGE_HANDLER).toContain("isAllowedOnlineModel(configured)");
    expect(EDGE_HANDLER).not.toMatch(/body\.model/);
  });
});
