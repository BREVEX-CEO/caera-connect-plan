import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PRODUCT_REFERENCE_PARITY,
  validateProductReferenceParity,
} from "../product-reference-parity";

describe("the dated public product-reference parity authority", () => {
  it("covers every reference product family and validates against real authorities", () => {
    expect(PRODUCT_REFERENCE_PARITY.length).toBe(31);
    expect(new Set(PRODUCT_REFERENCE_PARITY.map((item) => item.id)).size).toBe(31);
    expect(new Set(PRODUCT_REFERENCE_PARITY.map((item) => item.referenceProduct))).toEqual(
      new Set(["chat", "cowork", "code", "team", "enterprise"]),
    );
    expect(validateProductReferenceParity(PRODUCT_REFERENCE_PARITY, existsSync)).toEqual([]);
  });

  it("keeps the generated JSON as the source of the generated Markdown", () => {
    const json = JSON.parse(
      readFileSync("docs/product-reference/OCADE_REFERENCE_PARITY.json", "utf8"),
    );
    const markdown = readFileSync("docs/product-reference/OCADE_REFERENCE_PARITY.md", "utf8");
    expect(json.summary.total).toBe(PRODUCT_REFERENCE_PARITY.length);
    for (const item of json.capabilities) {
      expect(markdown).toContain(item.id);
      expect(markdown).toContain(item.documentedSource);
    }
  });

  it("rejects duplicate ids, private sources, missing authorities, and vacuous completion", () => {
    const base = PRODUCT_REFERENCE_PARITY[0]!;
    const problems = validateProductReferenceParity(
      [
        base,
        { ...base },
        {
          ...base,
          id: "CHAT-PRIVATE-SOURCE",
          documentedSource: "https://internal.example.invalid/private",
          currentOcadeAuthority: "src/does-not-exist.ts",
          implementationState: "complete",
          requiredTests: [],
          evidence: [],
        },
      ],
      existsSync,
    ).join("\n");

    expect(problems).toMatch(/duplicate id/);
    expect(problems).toMatch(/not an approved official HTTPS host/);
    expect(problems).toMatch(/does not exist/);
    expect(problems).toMatch(/complete without tests and evidence/);
  });
});
