/**
 * WHAT THE CHAT PAGE DOES WITH RETRIEVED EVIDENCE.
 *
 * `evidence-packet.test.ts` proves the packet is built correctly. This proves
 * the page uses it correctly, because the dangerous mistake is not in building
 * the packet — it is one line at the call site putting it on the system
 * message "just for context". A source-level test is the right shape for that:
 * the defect would be an edit to this file, so this file is what is watched.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const chat = readFileSync("src/routes/_authenticated/ocade.index.tsx", "utf8");

/** The block that decides whether to look anything up, and what to do with it. */
const researchBlock = chat.slice(
  chat.indexOf("const routing = routeForFreshness("),
  chat.indexOf("const images = atts"),
);

describe("Chat asks before it reaches for the network", () => {
  it("routes on freshness rather than retrieving on every message", () => {
    expect(researchBlock).toContain("routeForFreshness(");
    expect(researchBlock).toContain("if (routing.research)");
  });

  it("honours the person's switch, and being offline", () => {
    expect(researchBlock).toContain("navigator.onLine");
    expect(researchBlock).toContain("chatPrefs.research");
  });

  it("says so when it answered without checking, rather than staying silent", () => {
    expect(researchBlock).toContain("setRetrievalNotice");
    expect(chat).toContain("{retrievalNotice}");
  });
});

describe("retrieved pages never become instructions", () => {
  it("pushes the packet with the packet's own role, not a literal system", () => {
    expect(researchBlock).toContain("localMessages.push({ role: packet.role");
    expect(researchBlock).not.toMatch(/role:\s*"system"[\s\S]{0,200}packet/);
  });

  it("never appends retrieved content to the assembled system prompt", () => {
    /*
     * `sys` is the compiled system message. Nothing retrieved may be
     * concatenated onto it — that is the single edit that would turn a
     * webpage into OCADE's own rules.
     */
    expect(chat).not.toMatch(/sys\s*\+=/);
    expect(chat).not.toMatch(/content:\s*`\$\{sys\}[\s\S]{0,80}packet/);
  });

  it("keeps the evidence ahead of the question it is evidence for", () => {
    const packetPush = chat.indexOf("localMessages.push({ role: packet.role");
    const questionPush = chat.indexOf('          role: "user",\n          content: text,');
    expect(packetPush).toBeGreaterThan(-1);
    expect(questionPush).toBeGreaterThan(-1);
    expect(packetPush).toBeLessThan(questionPush);
  });
});

describe("a web citation is evidence a reader can check", () => {
  it("cites only sources the finished answer actually referred to", () => {
    const record = chat.slice(
      chat.indexOf("function recordCitations("),
      chat.indexOf("function recordCitations(") + 1800,
    );
    expect(record).toContain("webCitationsRef.current.filter");
  });

  it("renders a source's URL only through the scheme guard", () => {
    expect(chat).toContain("safeCitationHref(c.url)");
    // No raw href straight from the record.
    expect(chat).not.toMatch(/href=\{c\.url\}/);
  });

  it("opens an external source without handing it this window", () => {
    const sources = chat.slice(chat.indexOf("const href = safeCitationHref(c.url)"));
    expect(sources).toContain('rel="noreferrer noopener"');
  });

  it("shows when the source said it and when OCADE read it, as two dates", () => {
    expect(chat).toContain("c.asOf");
    expect(chat).toContain("c.retrievedAt");
  });
});
