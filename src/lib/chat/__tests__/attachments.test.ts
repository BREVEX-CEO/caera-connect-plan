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

/** A real PNG signature. What a file IS decides which path it takes. */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

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
    const read = await readAttachment(file("shot.png", "image/png", PNG), "id");
    expect(read.state).toBe("ready");
    expect(read.image).toBeTruthy();
    expect(read.text).toBeUndefined();
  });
});

describe("a file is what its bytes are, not what its name claims", () => {
  /*
   * `File.type` is the operating system guessing from an extension, and anyone
   * can rename anything. Without this, arbitrary bytes labelled `image/png`
   * were base64-encoded and sent to the provider as a picture.
   */
  it("refuses bytes that are not the image they claim to be", async () => {
    const read = await readAttachment(file("payload.png", "image/png", "not a png at all"), "id");
    expect(read.state).toBe("rejected");
    expect(read.reason).toMatch(/not an image/i);
  });

  it("reads SVG as the markup it is rather than as a picture", async () => {
    // It arrives as `image/svg+xml`, and markup can carry script. The image
    // path would have base64-encoded it and sent it to a vision model.
    const read = await readAttachment(
      file("logo.svg", "image/svg+xml", "<svg><script>x()</script></svg>"),
      "id",
    );
    expect(read.state).toBe("ready");
    expect(read.image).toBeUndefined();
    expect(read.text).toContain("<svg>");
  });

  it("never opens an archive, so there is no extraction to bound", async () => {
    // The cheapest defence against a decompression bomb is not to decompress.
    for (const name of ["bundle.zip", "backup.tar.gz", "data.7z"]) {
      const read = await readAttachment(file(name, "application/zip", PNG), "id");
      expect(read.state, name).toBe("rejected");
    }
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

  it("refuses the whole send over budget instead of dropping a chosen file", () => {
    const huge = ready({ id: "1", text: "x".repeat(MAX_TOTAL_BYTES) });
    const after = ready({ id: "2", name: "second.txt" });
    expect(forRequest([huge, after])).toMatchObject({ ok: false, reason: /too large/ });
    // Weighed as bytes: four 5 MiB photos are exactly the budget and all four go.
    const photo = (id: string) =>
      ready({ id, name: `${id}.png`, text: undefined, image: "A".repeat((5 * 1024 * 1024 * 4) / 3) });
    expect(sent(["a", "b", "c", "d"].map(photo)).map((a) => a.name)).toHaveLength(4);
    // UTF-8 bytes, not characters: multi-byte text is not under-counted.
    expect(forRequest([ready({ text: "é".repeat(MAX_TOTAL_BYTES / 2 + 1) })]).ok).toBe(false);
  });

  it("sends what was read, skips a rejection, and waits for a file still reading", () => {
    expect(
      sent([ready({ id: "1" }), ready({ id: "2", state: "rejected", name: "report.pdf" })]).map(
        (a) => a.name,
      ),
    ).toEqual(["notes.txt"]);
    expect(forRequest([ready({ id: "1" }), ready({ id: "3", state: "reading" })])).toMatchObject({
      ok: false,
      reason: /still being read/,
    });
  });

  it("keeps the order the composer shows, because order reaches the model", () => {
    const order = sent([ready({ id: "1", name: "first.txt" }), ready({ id: "2", name: "second.txt" })]);
    expect(order.map((a) => a.name)).toEqual(["first.txt", "second.txt"]);
  });
});

function sent(pending: Parameters<typeof forRequest>[0]) {
  const out = forRequest(pending);
  if (!out.ok) throw new Error(out.reason);
  return out.attachments;
}

describe("making an answer checkable", () => {
  it("asks for a source only when there is one", () => {
    expect(citationInstruction([])).toBeNull();
    const instruction = citationInstruction(sent([ready()]));
    expect(instruction).toMatch(/which file/i);
    expect(instruction).toMatch(/row|column|line|heading/i);
  });
});

describe("a bounded read, and untrusted content", () => {
  it("reads only the first megabyte of a large file, and says it did", async () => {
    // `file.text()` read the WHOLE file into memory before a character was
    // truncated, so an accidentally attached log was a tab the browser kills.
    const huge = file("big.log", "text/plain", "x".repeat(3 * 1024 * 1024));
    const read = await readAttachment(huge, "id");
    expect(read.state).toBe("ready");
    expect(read.text!.length).toBeLessThan(MAX_TEXT_CHARS + 500);
    expect(read.text).toContain("longer than OCADE can read at once");
  });

  it("tells the model that file contents are data, never instructions", () => {
    const instruction = citationInstruction([
      { name: "notes.txt", mime: "text/plain", sizeBytes: 5, text: "hello" },
    ])!;
    expect(instruction).toMatch(/never instructions/i);
  });
});
