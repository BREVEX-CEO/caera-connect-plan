import { describe, expect, it } from "vitest";
import {
  MAX_TEXT_CHARS,
  MAX_TOTAL_BYTES,
  citationInstruction,
  forRequest,
  readAttachment,
  type PendingAttachment,
} from "@/lib/chat/attachments";

const file = (name: string, type: string, body: string | Uint8Array = "hello") =>
  new File([body as BlobPart], name, { type });

const ready = (over: Partial<PendingAttachment> = {}): PendingAttachment => ({
  id: "a",
  name: "notes.txt",
  mime: "text/plain",
  sizeBytes: 5,
  state: "ready",
  text: "hello",
  ...over,
});

describe("what OCADE can read", () => {
  it("reads text, and everything a browser calls text", async () => {
    for (const [name, type] of [
      ["notes.txt", "text/plain"],
      ["sales.csv", "text/csv"],
      ["data.json", ""],
      ["main.py", ""],
      ["README.md", ""],
    ] as const) {
      const read = await readAttachment(file(name, type, "a,b\n1,2"), "id");
      expect(read.state, name).toBe("ready");
      expect(read.text, name).toBe("a,b\n1,2");
    }
  });

  it("keeps an image whole, for the engine that can actually see", async () => {
    const read = await readAttachment(file("shot.png", "image/png", "bytes"), "id");
    expect(read.state).toBe("ready");
    expect(read.image).toBeTruthy();
    expect(read.text).toBeUndefined();
  });
});

describe("what OCADE refuses, and how", () => {
  it("says what it cannot read and what to do instead", async () => {
    /*
     * The alternative was pulling the readable fragments out of a binary
     * container and presenting them as the document. An answer built on a
     * partial reading looks as complete as one built on the whole file.
     */
    const pdf = await readAttachment(file("report.pdf", "application/pdf"), "id");
    expect(pdf.state).toBe("rejected");
    expect(pdf.reason).toMatch(/cannot read PDFs/i);
    expect(pdf.reason).toMatch(/paste|text/i);

    const sheet = await readAttachment(file("book.xlsx", ""), "id");
    expect(sheet.state).toBe("rejected");
    expect(sheet.reason).toMatch(/CSV/);
  });

  it("refuses an empty file rather than sending nothing under a name", async () => {
    const read = await readAttachment(file("blank.txt", "text/plain", "   \n "), "id");
    expect(read.state).toBe("rejected");
  });

  it("never throws, whatever it is handed", async () => {
    const broken = {
      name: "x.txt",
      type: "text/plain",
      size: 1,
      text: () => Promise.reject(new Error("gone")),
    } as unknown as File;
    await expect(readAttachment(broken, "id")).resolves.toMatchObject({ state: "rejected" });
  });
});

describe("bounds, so one use cannot carry unlimited cost", () => {
  it("announces truncation in the text rather than cutting silently", async () => {
    // A model told nothing about the cut answers as though it read the whole
    // file, and confidently.
    const read = await readAttachment(
      file("big.txt", "text/plain", "x".repeat(MAX_TEXT_CHARS + 50)),
      "id",
    );
    expect(read.state).toBe("ready");
    expect(read.text!.length).toBeLessThan(MAX_TEXT_CHARS + 200);
    expect(read.text).toMatch(/first part of it/);
  });

  it("stops filling the request once the total budget is spent", () => {
    const huge = ready({ id: "1", text: "x".repeat(MAX_TOTAL_BYTES) });
    const after = ready({ id: "2", name: "second.txt" });
    expect(forRequest([huge, after]).map((a) => a.name)).toEqual(["notes.txt"]);
  });

  it("sends only what was read, never a rejection or a file still reading", () => {
    const sent = forRequest([
      ready({ id: "1" }),
      ready({ id: "2", state: "rejected", name: "report.pdf" }),
      ready({ id: "3", state: "reading", name: "slow.txt" }),
    ]);
    expect(sent.map((a) => a.name)).toEqual(["notes.txt"]);
  });

  it("keeps the order the composer shows, because order reaches the model", () => {
    const sent = forRequest([
      ready({ id: "1", name: "first.txt" }),
      ready({ id: "2", name: "second.txt" }),
    ]);
    expect(sent.map((a) => a.name)).toEqual(["first.txt", "second.txt"]);
  });
});

describe("making an answer checkable", () => {
  it("asks for a source only when there is one", () => {
    expect(citationInstruction([])).toBeNull();
    const instruction = citationInstruction(forRequest([ready()]));
    expect(instruction).toMatch(/which file/i);
    expect(instruction).toMatch(/row|column|line|heading/i);
  });
});
