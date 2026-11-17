/**
 * Library intake (threat register O-04/O-15): programs, scripts, macro documents, active PDFs and
 * archive bombs are refused from their bytes before anything is stored; ordinary files are kept.
 * Harmless synthetic fixtures only: no real malware.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { deflateRawSync } from "node:zlib";
import { intakeRefusal, zipEntries } from "../../src/lib/library/intake.ts";

/** A real ZIP built in memory: stored or deflated entries with a correct central directory. */
function zip(files: { name: string; data: Buffer; claimSize?: number }[]): Uint8Array {
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
    entry.writeUInt32LE(file.claimSize ?? file.data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    locals.push(local, name, body);
    central.push(entry, name);
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
