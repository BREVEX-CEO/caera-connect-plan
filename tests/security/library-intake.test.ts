/**
 * Library intake (threat register O-04/O-15): programs, scripts, macro documents, active PDFs and
 * archive bombs are refused from their bytes before anything is stored; ordinary files are kept.
 * Harmless synthetic fixtures only: no real malware.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
import { deflateRawSync } from "node:zlib";
import {
  intakeRefusal,
  intakeRefusalStored,
  libraryName,
  zipEntries,
} from "../../src/lib/library/intake.ts";

/** A real ZIP built in memory: stored or deflated entries with a correct central directory. */
function zip(
  files: { name: string; data: Buffer; claimSize?: number; zip64Size?: number }[],
): Uint8Array {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const body = deflateRawSync(file.data);
    const name = Buffer.from(file.name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(file.claimSize ?? file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt32LE(body.length, 20);
    entry.writeUInt32LE(
      file.zip64Size === undefined ? (file.claimSize ?? file.data.length) : 0xffffffff,
      24,
    );
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    // ZIP64 extra field (id 0x0001) carrying the real 8-byte uncompressed size.
    const extra = Buffer.alloc(file.zip64Size === undefined ? 0 : 12);
    if (file.zip64Size !== undefined) {
      extra.writeUInt16LE(1, 0);
      extra.writeUInt16LE(8, 2);
      extra.writeBigUInt64LE(BigInt(file.zip64Size), 4);
      entry.writeUInt16LE(extra.length, 30);
    }
    locals.push(local, name, body);
    central.push(entry, name, extra);
    offset += local.length + name.length + body.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, directory, end]));
}

const bytes = (text: string) => new Uint8Array(Buffer.from(text, "latin1"));

test("programs are refused by their bytes, whatever they are called", () => {
  for (const magic of ["MZ\x90\x00", "\x7fELF\x02", "\xcf\xfa\xed\xfe", "\xca\xfe\xba\xbe"]) {
    assert.equal(intakeRefusal(bytes(magic + "padding"), "holiday.jpg")?.code, "program");
  }
});

test("scripts and shortcuts are refused by name or by a #! line", () => {
  for (const name of ["setup.exe", "run.PS1", "a.bat", "x.vbs", "link.lnk", "page.hta", "tool.jar"])
    assert.equal(intakeRefusal(bytes("plain text"), name)?.code, "script", name);
  assert.equal(intakeRefusal(bytes("#!/bin/sh\nrm -rf ~"), "notes.txt")?.code, "script");
});

test("macro documents are refused; the same document without macros is kept", () => {
  assert.equal(intakeRefusal(bytes("anything"), "budget.xlsm")?.code, "macro");
  const legacy = Buffer.concat([
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    Buffer.from("_VBA_PROJECT", "utf16le"),
  ]);
  assert.equal(intakeRefusal(new Uint8Array(legacy), "old.doc")?.code, "macro");
  const withMacro = zip([
    { name: "[Content_Types].xml", data: Buffer.from("<Types/>") },
    { name: "word/vbaProject.bin", data: Buffer.from("macro") },
  ]);
  assert.equal(intakeRefusal(withMacro, "letter.docx")?.code, "macro");
  const clean = zip([
    { name: "[Content_Types].xml", data: Buffer.from("<Types/>") },
    { name: "word/document.xml", data: Buffer.from("<w:document/>") },
  ]);
  assert.equal(intakeRefusal(clean, "letter.docx"), null);
});

test("a PDF that launches a program or runs script is refused; a plain PDF is kept", () => {
  assert.equal(
    intakeRefusal(bytes("%PDF-1.7\n<< /OpenAction << /S /Launch >> >>"), "a.pdf")?.code,
    "active_pdf",
  );
  assert.equal(
    intakeRefusal(bytes("%PDF-1.7\n<< /S /JavaScript /JS (app.alert(1)) >>"), "b.pdf")?.code,
    "active_pdf",
  );
  assert.equal(intakeRefusal(bytes("%PDF-1.7\n<< /Type /Catalog >>"), "c.pdf"), null);
});

test("archive bombs and archives holding programs are refused; ordinary archives are kept", () => {
  const bomb = zip([{ name: "big.txt", data: Buffer.alloc(1000), claimSize: 3 * 1024 ** 3 }]);
  assert.equal(intakeRefusal(bomb, "photos.zip")?.code, "archive_bomb");
  const ratio = zip([{ name: "zeros.bin", data: Buffer.alloc(5_000_000) }]);
  assert.equal(intakeRefusal(ratio, "zeros.zip")?.code, "archive_bomb", "inflates 1000x");
  const hidden = zip([
    { name: "readme.txt", data: Buffer.from("hello") },
    { name: "bin/payload.exe", data: Buffer.from("not really") },
  ]);
  assert.equal(intakeRefusal(hidden, "docs.zip")?.code, "archive_content");
  const fine = zip([{ name: "a.txt", data: Buffer.from("hello world") }]);
  assert.equal(intakeRefusal(fine, "docs.zip"), null);
  assert.deepEqual(
    zipEntries(fine)?.map((entry) => entry.name),
    ["a.txt"],
  );
});

test("ordinary files are kept", () => {
  for (const [content, name] of [
    ["\x89PNG\r\n\x1a\n....", "photo.png"],
    ["name,amount\nA,1\n", "data.csv"],
    ["Meeting notes", "notes.txt"],
  ])
    assert.equal(intakeRefusal(bytes(content), name), null, name);
});

/** A stored file read by range and as a stream in small chunks (patterns cross chunk borders). */
function stored(data: Uint8Array) {
  return {
    size: data.length,
    range: async (start: number, end: number) => data.slice(start, end),
    whole: async () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          for (let at = 0; at < data.length; at += 7) controller.enqueue(data.slice(at, at + 7));
          controller.close();
        },
      }),
  };
}

test("a stored large file gets the same decision without being held in memory (14E.4)", async () => {
  const pad = (head: string, filler: number, tail: string) =>
    new Uint8Array(
      Buffer.concat([
        Buffer.from(head, "latin1"),
        Buffer.alloc(filler, 0x20),
        Buffer.from(tail, "latin1"),
      ]),
    );
  const cases: [Uint8Array, string, string | null][] = [
    [pad("%PDF-1.7\n", 200_000, "<< /S /JavaScript >>"), "late.pdf", "active_pdf"],
    [pad("%PDF-1.7\n", 200_000, "<< /Type /Catalog >>"), "fine.pdf", null],
    [
      new Uint8Array(
        Buffer.concat([
          Buffer.from([0xd0, 0xcf, 0x11, 0xe0]),
          Buffer.alloc(100_000),
          Buffer.from("_VBA_PROJECT", "utf16le"),
        ]),
      ),
      "old.doc",
      "macro",
    ],
    [bytes("MZ\x90\x00 padding"), "a.jpg", "program"],
    [
      zip([
        { name: "readme.txt", data: randomBytes(300_000) },
        { name: "bin/payload.exe", data: Buffer.from("x") },
      ]),
      "docs.zip",
      "archive_content",
    ],
    [zip([{ name: "a.txt", data: Buffer.from("hello world") }]), "docs.zip", null],
    [
      zip([{ name: "big.txt", data: Buffer.alloc(1000), claimSize: 3 * 1024 ** 3 }]),
      "p.zip",
      "archive_bomb",
    ],
  ];
  for (const [data, name, expected] of cases) {
    const file = stored(data);
    const refused = await intakeRefusalStored(file.size, name, file.range, file.whole);
    assert.equal(refused?.code ?? null, expected, name);
    assert.equal(intakeRefusal(data, name)?.code ?? null, expected, `${name} in memory`);
  }
});

test("UPLOAD-08: a name reads the same as it is checked; invisible and direction characters go", () => {
  // "invoice<RLO>fdp.exe" displays as "invoiceexe.pdf"; without the override it is plainly a program.
  const disguised = "invoice\u202Efdp.exe";
  assert.equal(libraryName(disguised), "invoicefdp.exe");
  assert.equal(intakeRefusal(new Uint8Array([1, 2, 3]), libraryName(disguised))?.code, "script");
  assert.equal(libraryName("re\u200Bport\u2066.pdf\u2069"), "report.pdf");
  assert.equal(libraryName("tab\tand\u0000null.txt"), "tabandnull.txt");
  // Composed and decomposed forms of one name are one name.
  assert.equal(libraryName("café.txt"), libraryName("café.txt"));
  assert.equal(libraryName("  ordinary name.docx "), "ordinary name.docx");
});

test("an archive with more than the entry cap is refused without walking it all", () => {
  const many = zip(
    Array.from({ length: 20_001 }, (_, n) => ({ name: `f${n}.txt`, data: Buffer.from("x") })),
  );
  assert.equal(intakeRefusal(many, "many.zip")?.code, "archive_bomb");
  assert.equal(zipEntries(many)?.length, 20_001, "the walk stops one past the cap");
});

test("a ZIP64 entry's real size is measured, and an unreadable ZIP64 size is the largest, not zero", () => {
  const big = zip([{ name: "huge.bin", data: Buffer.alloc(10), zip64Size: 5 * 1024 ** 3 }]);
  assert.equal(zipEntries(big)?.[0]?.uncompressed, 5 * 1024 ** 3);
  assert.equal(intakeRefusal(big, "huge.zip")?.code, "archive_bomb");
  const small = zip([{ name: "ok.bin", data: Buffer.alloc(10), zip64Size: 10 }]);
  assert.equal(zipEntries(small)?.[0]?.uncompressed, 10);
  // a marker with no extra field behind it
  const broken = Buffer.from(small);
  const at = broken.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  broken.writeUInt16LE(0, at + 30);
  assert.equal(zipEntries(broken)?.[0]?.uncompressed, Number.MAX_SAFE_INTEGER);
  assert.equal(intakeRefusal(broken, "broken.zip")?.code, "archive_bomb");
});
