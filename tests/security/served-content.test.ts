/** UPLOAD-04: a stored file is never a document the site's storage serves for a browser to run. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { imageMediaType } from "../../src/lib/media-type.ts";

const bytes = (text: string) => new TextEncoder().encode(text.padEnd(16, " "));

test("only real raster image signatures are served as images; SVG, HTML and programs are not", () => {
  assert.equal(
    imageMediaType(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0)),
    "image/png",
  );
  assert.equal(
    imageMediaType(Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0)),
    "image/jpeg",
  );
  for (const hostile of [
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">',
    "<!doctype html><script>alert(1)</script>",
    "<html>",
    "MZ\u0090\u0000\u0003",
    "#!/bin/sh",
  ]) {
    assert.equal(imageMediaType(bytes(hostile)), null, hostile);
  }
});

test("the library stores what the bytes are, never the caller's declared type", () => {
  const source = readFileSync("src/lib/library/library.functions.ts", "utf8");
  assert.match(
    source,
    /storedType = signature && kind === "image" \? signature : "application\/octet-stream"/,
  );
  assert.match(source, /contentType: storedType/);
  assert.doesNotMatch(
    source,
    /contentType:\s*data\.mime/,
    "the declared mime type must not reach storage",
  );
  // a download link names the file as an attachment
  assert.match(
    source,
    /createSignedUrl\(row\.storage_path, 60, data\.download \? \{ download: row\.name \} : undefined\)/,
  );
});
