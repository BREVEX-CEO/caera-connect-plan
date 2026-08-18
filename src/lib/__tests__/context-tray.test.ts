import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildContextTray,
  describeEntry,
  summariseTray,
  type ContextEntry,
} from "../chat/context-tray";
import { RETRIEVAL_THRESHOLD_CHARS } from "../retrieval/select";

/**
 * The tray must describe what will actually be sent.
 *
 * A tray that lists the right names but the wrong TREATMENT is the subtle
 * failure: "report.pdf" alongside an implied promise that OCADE read all of it,
 * when in fact it searched a 200-page file and used four sections. Both are
 * defensible behaviours; only one of them is what happened, and the user reads
 * the answer differently depending on which.
 */

const short = "a".repeat(100);
const long = "b".repeat(RETRIEVAL_THRESHOLD_CHARS + 1);

describe("what will happen to each source", () => {
  it("marks a short document as read in full", () => {
    const [entry] = buildContextTray({
      attachments: [{ name: "note.txt", extractedText: short }],
      projectFiles: [],
    });
    expect(entry.treatment).toBe("whole");
    expect(describeEntry(entry)).toMatch(/read in full/i);
  });

  it("marks a long document as searched, not read", () => {
    const [entry] = buildContextTray({
      attachments: [{ name: "report.pdf", extractedText: long }],
      projectFiles: [],
    });
    expect(entry.treatment).toBe("searched");
    // The wording has to be a search, because that is what it is.
    expect(describeEntry(entry)).toMatch(/search/i);
    expect(describeEntry(entry)).not.toMatch(/read in full/i);
  });

  it("uses the same threshold the retrieval code uses", () => {
    // A second copy of the number would drift, and the tray would then promise
    // one treatment while the sender performed the other.
    const under = buildContextTray({
      attachments: [{ name: "a", extractedText: "x".repeat(RETRIEVAL_THRESHOLD_CHARS) }],
      projectFiles: [],
    });
    const over = buildContextTray({
      attachments: [{ name: "b", extractedText: "x".repeat(RETRIEVAL_THRESHOLD_CHARS + 1) }],
      projectFiles: [],
    });
    expect(under[0].treatment).toBe("whole");
    expect(over[0].treatment).toBe("searched");
  });
});

describe("unreadable sources are listed, not hidden", () => {
  it("shows an attachment nothing could be read from", () => {
    /*
     * Hiding it would be the worst option: the file is visibly attached in the
     * composer, so its absence from the tray reads as "this will be used".
     */
    const [entry] = buildContextTray({
      attachments: [{ name: "scan.png", extractedText: "" }],
      projectFiles: [],
    });
    expect(entry.treatment).toBe("unreadable");
    expect(entry.chars).toBe(0);
    expect(describeEntry(entry)).toMatch(/not be part of the answer|could be read/i);
  });

  it("carries the extractor's own reason when there is one", () => {
    const [entry] = buildContextTray({
      attachments: [
        {
          name: "locked.pdf",
          extractedText: "",
          unreadableReason: "This PDF is password protected.",
        },
      ],
      projectFiles: [],
    });
    expect(describeEntry(entry)).toBe("This PDF is password protected.");
  });

  it("does not count unreadable sources in the summary", () => {
    const summary = summariseTray(
      buildContextTray({
        attachments: [
          { name: "good.txt", extractedText: short },
          { name: "bad.png", extractedText: "" },
        ],
        projectFiles: [],
      }),
    );
    expect(summary).toMatch(/^1 source/);
  });

  it("says so when nothing at all can be read", () => {
    const summary = summariseTray(
      buildContextTray({
        attachments: [{ name: "bad.png", extractedText: "" }],
        projectFiles: [],
      }),
    );
    expect(summary).toMatch(/answered without it/i);
  });
});

describe("where each source came from", () => {
  it("distinguishes an attachment from a project file", () => {
    const entries = buildContextTray({
      attachments: [{ name: "now.txt", extractedText: short }],
      projectFiles: [{ id: "p1", name: "earlier.txt", text: short }],
    });
    expect(entries.map((e) => e.origin)).toEqual(["attachment", "project"]);
  });

  it("includes local memory when there is any", () => {
    const entries = buildContextTray({ attachments: [], projectFiles: [], memoryChars: 500 });
    expect(entries).toHaveLength(1);
    expect(entries[0].origin).toBe("memory");
  });

  it("omits memory entirely when it is empty", () => {
    expect(buildContextTray({ attachments: [], projectFiles: [], memoryChars: 0 })).toHaveLength(0);
  });

  it("does not offer to remove memory from a single question", () => {
    /*
     * Memory is turned off in Settings, not detached per message. Dropping it
     * for one question would make that answer inconsistent with the last for a
     * reason the user could not reconstruct.
     */
    const [entry] = buildContextTray({ attachments: [], projectFiles: [], memoryChars: 500 });
    expect(entry.removable).toBe(false);
  });

  it("lets every document be removed", () => {
    const entries = buildContextTray({
      attachments: [{ name: "a.txt", extractedText: short }],
      projectFiles: [{ id: "p1", name: "b.txt", text: short }],
    });
    expect(entries.every((e) => e.removable)).toBe(true);
  });
});

describe("the summary is accurate in every mix", () => {
  it("returns null with nothing attached, so no empty box is rendered", () => {
    expect(summariseTray([])).toBeNull();
  });

  it("counts one source in the singular", () => {
    expect(
      summariseTray(
        buildContextTray({ attachments: [{ name: "a", extractedText: short }], projectFiles: [] }),
      ),
    ).toMatch(/1 source,/);
  });

  it("describes an all-searched set as searched", () => {
    const summary = summariseTray(
      buildContextTray({
        attachments: [
          { name: "a", extractedText: long },
          { name: "b", extractedText: long },
        ],
        projectFiles: [],
      }),
    );
    expect(summary).toMatch(/2 sources, searched/);
  });

  it("describes a mixed set as mixed rather than picking one", () => {
    const summary = summariseTray(
      buildContextTray({
        attachments: [
          { name: "a", extractedText: long },
          { name: "b", extractedText: short },
        ],
        projectFiles: [],
      }),
    );
    expect(summary).toMatch(/1 searched, the rest read in full/);
  });

  it("never claims a long document was read in full", () => {
    const summary = summariseTray(
      buildContextTray({ attachments: [{ name: "a", extractedText: long }], projectFiles: [] }),
    );
    expect(summary).not.toMatch(/each read in full/);
  });
});

describe("identifiers are stable enough to exclude by", () => {
  it("gives project files an id derived from the file", () => {
    const [entry] = buildContextTray({
      attachments: [],
      projectFiles: [{ id: "p-42", name: "x", text: short }],
    });
    expect(entry.id).toBe("project:p-42");
  });

  it("gives every entry a distinct id", () => {
    const entries = buildContextTray({
      attachments: [
        { name: "a", extractedText: short },
        { name: "a", extractedText: short }, // same name on purpose
      ],
      projectFiles: [{ id: "p1", name: "a", text: short }],
      memoryChars: 10,
    });
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  });
});

describe("removing a source actually changes the request", () => {
  const CHAT = readFileSync("src/routes/_authenticated/ocade.index.tsx", "utf8");

  it("filters exclusions where the context is built, not only where it is shown", () => {
    /*
     * THE FAILURE THIS PINS. Filtering only the tray's own list leaves a
     * control that changes a label and not the request. That is worse than no
     * control at all: it invites the user to believe a document was withheld
     * from the engine when it was sent in full.
     */
    const builder = CHAT.slice(CHAT.indexOf("function buildDocContext"));
    expect(builder.slice(0, 1500)).toMatch(/excludedContext\.has\(/);
  });

  it("detaches an attachment outright but only excludes a project file", () => {
    // A project file must survive the question it was skipped for.
    expect(CHAT).toMatch(/entry\.origin === "attachment"/);
    expect(CHAT).toMatch(
      /setExcludedContext\(\(current\) => new Set\(current\)\.add\(entry\.id\)\)/,
    );
  });

  it("offers a way back", () => {
    // Without this the source vanishes with no way to restore it.
    expect(CHAT).toMatch(/setExcludedContext\(new Set\(\)\)/);
  });
});

describe("the tray renders nothing when there is nothing to say", () => {
  const COMPONENT = readFileSync("src/components/ocade/chat/ContextTray.tsx", "utf8");

  it("returns null on an empty summary", () => {
    // An empty box announcing that nothing is attached is noise on the
    // most-used screen in the product.
    expect(COMPONENT).toMatch(/if \(!summary\) return null/);
  });

  it("labels the removal control with the file it affects", () => {
    const entry: ContextEntry = {
      id: "project:1",
      name: "budget.xlsx",
      origin: "project",
      treatment: "whole",
      chars: 10,
      removable: true,
    };
    expect(entry.name).toBe("budget.xlsx");
    // A bare "×" gives a screen-reader user no way to tell the rows apart.
    expect(COMPONENT).toMatch(/aria-label=\{`Do not use \$\{entry\.name\}/);
  });
});
