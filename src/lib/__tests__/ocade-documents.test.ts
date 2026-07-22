import { describe, it, expect } from "vitest";
import {
  classifyFile,
  isNativeTextKind,
  splitDelimited,
  summariseTabular,
  extractDocument,
  clampForContext,
  DOCUMENT_PACK_REASON,
} from "../ocade-documents";

describe("classifyFile", () => {
  it.each([
    ["notes.md", "", "markdown"],
    ["data.csv", "", "csv"],
    ["data.tsv", "", "tsv"],
    ["config.json", "", "json"],
    ["report.pdf", "", "pdf"],
    ["contract.docx", "", "docx"],
    ["budget.xlsx", "", "xlsx"],
    ["readme.txt", "", "text"],
    ["main.ts", "", "code"],
    ["script.py", "", "code"],
  ])("classifies %s as %s", (name, mime, kind) => {
    expect(classifyFile(name, mime)).toBe(kind);
  });

  it("falls back to MIME when the extension is unknown", () => {
    expect(classifyFile("blob", "image/png")).toBe("image");
    expect(classifyFile("blob", "video/mp4")).toBe("video");
    expect(classifyFile("blob", "application/pdf")).toBe("pdf");
    expect(classifyFile("blob", "text/plain")).toBe("text");
    expect(classifyFile("blob", "application/octet-stream")).toBe("unknown");
  });

  it("knows which kinds are readable offline without a decoder", () => {
    expect(isNativeTextKind("markdown")).toBe(true);
    expect(isNativeTextKind("code")).toBe(true);
    expect(isNativeTextKind("pdf")).toBe(false);
    expect(isNativeTextKind("image")).toBe(false);
  });
});

describe("splitDelimited", () => {
  it("splits plain fields", () => {
    expect(splitDelimited("a,b,c", ",")).toEqual(["a", "b", "c"]);
  });
  it("respects quoted fields containing the delimiter", () => {
    expect(splitDelimited('a,"b,c",d', ",")).toEqual(["a", "b,c", "d"]);
  });
  it("handles escaped double quotes", () => {
    expect(splitDelimited('"he said ""hi""",x', ",")).toEqual(['he said "hi"', "x"]);
  });
  it("supports tabs", () => {
    expect(splitDelimited("a\tb", "\t")).toEqual(["a", "b"]);
  });
});

describe("summariseTabular", () => {
  const csv = 'name,qty\nwidget,3\ngadget,5\nbolt,9';
  it("extracts columns and row count", () => {
    const s = summariseTabular(csv, ",");
    expect(s.columns).toEqual(["name", "qty"]);
    expect(s.rowCount).toBe(3);
    expect(s.preview).toContain("Columns (2)");
    expect(s.preview).toContain("widget | 3");
  });
  it("bounds the preview", () => {
    const many = "a\n" + Array.from({ length: 100 }, (_, i) => String(i)).join("\n");
    const s = summariseTabular(many, ",", 5);
    expect(s.rowCount).toBe(100);
    expect(s.preview.split("\n").filter((l) => /^\d+$/.test(l))).toHaveLength(5);
  });
});

describe("extractDocument", () => {
  it("extracts plain text and counts", () => {
    const r = extractDocument({ name: "a.txt", sizeBytes: 10, content: "hello world\nsecond line" });
    expect(r.status).toBe("ok");
    expect(r.text).toContain("hello world");
    expect(r.meta.wordCount).toBe(4);
    expect(r.meta.lineCount).toBe(2);
  });

  it("summarises CSV into columns + preview", () => {
    const r = extractDocument({ name: "d.csv", sizeBytes: 20, content: "x,y\n1,2" });
    expect(r.status).toBe("ok");
    expect(r.meta.columnCount).toBe(2);
    expect(r.meta.rowCount).toBe(1);
  });

  it("detects code language", () => {
    const r = extractDocument({ name: "m.py", sizeBytes: 5, content: "print(1)" });
    expect(r.meta.language).toBe("Python");
    expect(r.status).toBe("ok");
  });

  it("describes JSON structure honestly", () => {
    const r = extractDocument({ name: "c.json", sizeBytes: 5, content: '{"a":1,"b":2}' });
    expect(r.text).toContain("object with keys: a, b");
  });

  it.each(["r.pdf", "c.docx", "b.xlsx"])(
    "refuses %s honestly instead of faking extraction",
    (name) => {
      const r = extractDocument({ name, sizeBytes: 100 });
      expect(r.status).toBe("needs_document_pack");
      expect(r.text).toBeNull();
      expect(r.reason).toBe(DOCUMENT_PACK_REASON);
    },
  );

  it("returns metadata-only for images and video, never a fabricated transcript", () => {
    const img = extractDocument({ name: "p.png", mime: "image/png", sizeBytes: 10 });
    expect(img.status).toBe("metadata_only");
    expect(img.text).toBeNull();

    const vid = extractDocument({ name: "v.mp4", mime: "video/mp4", sizeBytes: 10 });
    expect(vid.status).toBe("metadata_only");
    expect(vid.text).toBeNull();
    expect(vid.reason).toMatch(/does not transcribe/i);
  });

  it("reports empty files", () => {
    expect(extractDocument({ name: "e.txt", sizeBytes: 0, content: "   " }).status).toBe("empty");
  });

  it("marks genuinely unsupported types", () => {
    expect(extractDocument({ name: "x.bin", mime: "application/octet-stream", sizeBytes: 4 }).status).toBe(
      "unsupported",
    );
  });
});

describe("clampForContext", () => {
  it("passes short text through", () => {
    expect(clampForContext("short").truncated).toBe(false);
  });
  it("truncates and says so", () => {
    const r = clampForContext("x".repeat(100), 10);
    expect(r.truncated).toBe(true);
    expect(r.text).toContain("truncated 90 characters");
  });
});
