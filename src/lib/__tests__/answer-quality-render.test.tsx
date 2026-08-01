import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AnswerQualityPanel } from "@/components/ocade/AnswerQualityPanel";

/**
 * RENDER PROOF for the answer-quality panel — and the reachability guard that
 * keeps answer-composition + cited-answer from re-orphaning.
 */

const html = () => renderToStaticMarkup(<AnswerQualityPanel />);

describe("the answer-quality panel", () => {
  it("mounts without throwing", () => {
    expect(() => html()).not.toThrow();
  });

  it("offers both checks and describes them honestly", () => {
    const out = html();
    expect(out).toContain("Separate the claims");
    expect(out).toContain("Cite the evidence");
    expect(out).toMatch(/an inference is never\s+read as a fact/i);
  });

  it("shows no result region before a check is chosen", () => {
    expect(html()).not.toContain('role="status"');
  });

  it("imports both composer modules (reachability guard)", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(
        new URL("../../components/ocade/AnswerQualityPanel.tsx", import.meta.url),
        "utf8",
      ),
    );
    expect(src).toContain("chat/answer-composition");
    expect(src).toContain("research/cited-answer");
  });
});
