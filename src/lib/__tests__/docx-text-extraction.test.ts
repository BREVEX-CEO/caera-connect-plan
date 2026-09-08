import { describe, expect, it } from "vitest";
import { deflateRawSync } from "node:zlib";
import { decodeDocx } from "@/lib/ocade-decoders";

/**
 * A .docx READ WITHOUT MAMMOTH — proven against real Word markup.
 *
 * WHY THIS FILE EXISTS. The decoder used to call `mammoth.extractRawText`, 487
 * KiB of library for one call whose whole job is to discard formatting and
 * return plain text. `PLAN.md` §26 caps total JavaScript at 4,200 KiB, and that
 * was where a large slice of the budget went.
 *
 * The replacement reads the archive directly, which is safe only if it produces
 * the same text. The existing decoder suite covers corrupt files, cancellation
 * and size limits and NEVER decodes a valid document, so all thirty-five of its
 * tests passed against the new code while proving nothing about it. These are
 * the cases that actually matter, and every one is markup Word really emits.
 */

const encoder = new TextEncoder();

/** A stored ZIP built without the parser under test. */
function makeZip(files: Record<string, string>, compressed = false): ArrayBuffer {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let c = i;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (bytes: Uint8Array) => {
    let c = 0xffffffff;
    for (const byte of bytes) c = table[(c ^ byte) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };

  for (const [name, text] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(text);
    const stored = compressed ? Uint8Array.from(deflateRawSync(data)) : data;
    const crc = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length + stored.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, compressed ? 8 : 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, stored.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(stored, 30 + nameBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, compressed ? 8 : 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, stored.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);

    offset += local.length;
  }

  const directory = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, centrals.length, true);
  endView.setUint16(10, centrals.length, true);
  endView.setUint32(12, directory, true);
  endView.setUint32(16, offset, true);

  const total = offset + directory + end.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, at);
    at += part.length;
  }
  return out.buffer;
}

/** Wrap document-body markup in the envelope Word writes. */
function docx(body: string): ArrayBuffer {
  return makeZip({
    "[Content_Types].xml": "<Types/>",
    "word/document.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}</w:body></w:document>`,
  });
}

const paragraph = (...runs: string[]) => `<w:p><w:r>${runs.join("")}</w:r></w:p>`;
const text = (value: string, preserve = false) =>
  `<w:t${preserve ? ' xml:space="preserve"' : ""}>${value}</w:t>`;

describe("a real document reads as the text a person sees", () => {
  it("returns each paragraph on its own line", async () => {
    const result = await decodeDocx(
      docx(paragraph(text("The first paragraph.")) + paragraph(text("The second."))),
    );
    expect(result.status).toBe("ok");
    expect(result.text).toBe("The first paragraph.\nThe second.");
  });

  it("joins the runs Word splits a sentence into", async () => {
    /*
     * Word splits a single sentence across runs whenever formatting changes
     * mid-line — one bold word produces three runs. Reading runs as separate
     * lines would shred every styled sentence in the document.
     */
    const split =
      "<w:p>" +
      `<w:r>${text("A sentence with ", true)}</w:r>` +
      `<w:r><w:rPr><w:b/></w:rPr>${text("one bold word")}</w:r>` +
      `<w:r>${text(" in the middle.", true)}</w:r>` +
      "</w:p>";
    const result = await decodeDocx(docx(split));
    expect(result.text).toBe("A sentence with one bold word in the middle.");
  });

  it("honours xml:space so words do not run together", async () => {
    // THE DEFECT THIS CATCHES: "Dear " + "Alex" arriving as "DearAlex".
    const runs =
      "<w:p>" + `<w:r>${text("Dear ", true)}</w:r>` + `<w:r>${text("Alex")}</w:r>` + "</w:p>";
    expect((await decodeDocx(docx(runs))).text).toBe("Dear Alex");
  });

  it("turns tabs and line breaks into real whitespace", async () => {
    const result = await decodeDocx(
      docx(paragraph(text("Name"), "<w:tab/>", text("Value"), "<w:br/>", text("Second line"))),
    );
    expect(result.text).toBe("Name\tValue\nSecond line");
  });

  it("reads table cells, which are paragraphs like any other", async () => {
    const table =
      "<w:tbl><w:tr>" +
      `<w:tc>${paragraph(text("Left"))}</w:tc>` +
      `<w:tc>${paragraph(text("Right"))}</w:tc>` +
      "</w:tr></w:tbl>";
    const result = await decodeDocx(docx(table));
    expect(result.text).toContain("Left");
    expect(result.text).toContain("Right");
  });

  it("decodes XML entities rather than showing them raw", async () => {
    const result = await decodeDocx(docx(paragraph(text("Tom &amp; Jerry &lt;3 &#233;"))));
    expect(result.text).toBe("Tom & Jerry <3 é");
  });

  it("counts words and splits sections on blank lines", async () => {
    const result = await decodeDocx(
      docx(paragraph(text("First section.")) + "<w:p/>" + paragraph(text("Second section."))),
    );
    expect(result.sections.map((section) => section.text)).toEqual([
      "First section.",
      "Second section.",
    ]);
    expect(result.meta.wordCount).toBe(4);
  });
});

describe("what the document does NOT show is not read back", () => {
  it("skips field codes, which are instructions and not prose", async () => {
    /*
     * `<w:instrText>` holds the CODE — `HYPERLINK "https://…"`, `PAGE`,
     * `MERGEFIELD` — not the result a reader sees. Including it leaks raw URLs
     * and merge syntax into what the model reads as the document's words.
     */
    const field =
      "<w:p>" +
      `<w:r>${text("See ", true)}</w:r>` +
      '<w:r><w:instrText xml:space="preserve"> HYPERLINK "https://example.invalid/secret" </w:instrText></w:r>' +
      `<w:r>${text("the site.")}</w:r>` +
      "</w:p>";
    const result = await decodeDocx(docx(field));
    expect(result.text).toBe("See the site.");
    expect(result.text).not.toContain("HYPERLINK");
    expect(result.text).not.toContain("example.invalid");
  });

  it("skips text somebody deleted under tracked changes", async () => {
    /*
     * `<w:delText>` is content a reviewer REMOVED. Reading it back shows a
     * person deleted text as though it were still in the document — which can
     * be the most sensitive thing in the file.
     */
    const tracked =
      "<w:p>" +
      `<w:r>${text("The agreed figure is ", true)}</w:r>` +
      "<w:del><w:r><w:delText>£50,000</w:delText></w:r></w:del>" +
      `<w:ins><w:r>${text("£65,000")}</w:r></w:ins>` +
      "</w:p>";
    const result = await decodeDocx(docx(tracked));
    expect(result.text).toBe("The agreed figure is £65,000");
    expect(result.text).not.toContain("50,000");
  });

  it("reports an empty document as empty rather than as text", async () => {
    const result = await decodeDocx(docx("<w:p/>"));
    expect(result.status).toBe("empty");
    expect(result.text).toBe("");
  });
});

describe("it still behaves when the archive is compressed", () => {
  it("reads a deflated document.xml", async () => {
    // Real Word output is always deflated; a stored-only reader would fail on
    // every genuine file while passing every test above.
    const zip = makeZip(
      {
        "[Content_Types].xml": "<Types/>",
        "word/document.xml": `<w:document xmlns:w="x"><w:body>${paragraph(
          text("Compressed content."),
        )}</w:body></w:document>`,
      },
      true,
    );
    const result = await decodeDocx(zip);
    expect(result.status).toBe("ok");
    expect(result.text).toBe("Compressed content.");
  });
});
