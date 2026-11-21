/**
 * WHAT A LIBRARY UPLOAD IS ALLOWED TO BE (threat register O-04/O-15, scenario 1).
 *
 * The Library keeps a person's files; it is not a place to stage programs. Before anything is
 * stored, the bytes themselves (never the name or type the caller declared alone) are checked for
 * what could run or carry code: native programs, scripts and shortcuts, Office documents with
 * macros, PDFs that launch programs or run script, and archives that would inflate beyond any
 * reasonable size or that hold any of those. Such a file is refused with the reason, and nothing is
 * stored. Everything else is kept as inert bytes: images are shown only as the image format their
 * first bytes are, and every other file is only ever downloaded, never opened inside OCADE.
 *
 * This is a static check, not a virus scan, and the product says so: no antivirus engine runs here.
 */

export type IntakeRefusal =
  "program" | "script" | "macro" | "active_pdf" | "archive_bomb" | "archive_content";

const REASONS: Record<IntakeRefusal, string> = {
  program: "This is a program. The Library does not keep programs.",
  script: "This is a script or shortcut that can run code. The Library does not keep those.",
  macro: "This Office document contains macros. Save a copy without macros, then add that.",
  active_pdf: "This PDF can start programs or run script. The Library does not keep it.",
  archive_bomb:
    "This archive would unpack to far more than it holds. The Library does not keep it.",
  archive_content: "This archive holds a program, script or macro document.",
};

const RUNNABLE_NAMES =
  /\.(exe|dll|sys|scr|com|pif|cpl|msi|msix|msp|appx|bat|cmd|ps1|psm1|vbs|vbe|js|jse|wsf|wsh|hta|lnk|url|reg|inf|jar|sh|bash|zsh|command|app|scpt|applescript|workflow|desktop|apk|deb|rpm|iso|img|dmg|vhd|vhdx)$/i;
const MACRO_NAMES = /\.(docm|dotm|xlsm|xltm|xlam|pptm|potm|ppsm|ppam)$/i;

function starts(bytes: Uint8Array, ...magic: number[]): boolean {
  return magic.every((byte, i) => bytes[i] === byte);
}

/** A native program for Windows, Linux or macOS, by its first bytes. */
function isProgram(bytes: Uint8Array): boolean {
  return (
    starts(bytes, 0x4d, 0x5a) || // MZ: Windows PE
    starts(bytes, 0x7f, 0x45, 0x4c, 0x46) || // ELF
    starts(bytes, 0xfe, 0xed, 0xfa, 0xce) ||
    starts(bytes, 0xfe, 0xed, 0xfa, 0xcf) ||
    starts(bytes, 0xce, 0xfa, 0xed, 0xfe) ||
    starts(bytes, 0xcf, 0xfa, 0xed, 0xfe) ||
    starts(bytes, 0xca, 0xfe, 0xba, 0xbe) // Mach-O, and fat binaries
  );
}

function contains(bytes: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let i = 0; i + needle.length <= bytes.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) if (bytes[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

const ascii = (text: string) => new TextEncoder().encode(text);
const utf16 = (text: string) => new Uint8Array([...text].flatMap((c) => [c.charCodeAt(0), 0]));
const VBA_STREAM = utf16("_VBA_PROJECT");

interface ZipEntry {
  name: string;
  compressed: number;
  uncompressed: number;
}

/** The entries of a ZIP's central directory, or null when it cannot be read. */
export function zipEntries(bytes: Uint8Array): ZipEntry[] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end-of-central-directory record is within the last 64 KiB + 22 bytes.
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) return null;
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const entries: ZipEntry[] = [];
  for (let n = 0; n < count; n += 1) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) return null;
    const compressed = view.getUint32(at + 20, true);
    const uncompressed = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extra = view.getUint16(at + 30, true);
    const comment = view.getUint16(at + 32, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
    entries.push({ name, compressed, uncompressed });
    at += 46 + nameLength + extra + comment;
  }
  return entries;
}

const MAX_UNPACKED = 2 * 1024 ** 3;
const MAX_RATIO = 200;
const MAX_ENTRIES = 20_000;

/** Null when the file may be kept; otherwise why it is refused, in the person's words. */
export function intakeRefusal(
  bytes: Uint8Array,
  name: string,
): { code: IntakeRefusal; reason: string } | null {
  const refuse = (code: IntakeRefusal) => ({ code, reason: REASONS[code] });
  if (isProgram(bytes)) return refuse("program");
  if (RUNNABLE_NAMES.test(name) || starts(bytes, 0x23, 0x21)) return refuse("script"); // #!
  if (MACRO_NAMES.test(name)) return refuse("macro");
  // Older Office files (a compound file) carry macros in a stream named _VBA_PROJECT.
  if (starts(bytes, 0xd0, 0xcf, 0x11, 0xe0) && contains(bytes, VBA_STREAM)) return refuse("macro");
  if (starts(bytes, 0x25, 0x50, 0x44, 0x46)) {
    // %PDF: an action that launches a program or runs script.
    if (contains(bytes, ascii("/Launch")) || contains(bytes, ascii("/JavaScript")))
      return refuse("active_pdf");
  }
  if (starts(bytes, 0x50, 0x4b, 0x03, 0x04) || starts(bytes, 0x50, 0x4b, 0x05, 0x06)) {
    const entries = zipEntries(bytes);
    if (!entries) return null; // not a readable archive: kept as inert bytes, never unpacked here
    return archiveRefusal(entries, bytes.length, name);
  }
  return null;
}

function archiveRefusal(entries: ZipEntry[], size: number, name: string) {
  const refuse = (code: IntakeRefusal) => ({ code, reason: REASONS[code] });
  const unpacked = entries.reduce((sum, entry) => sum + entry.uncompressed, 0);
  if (
    entries.length > MAX_ENTRIES ||
    unpacked > MAX_UNPACKED ||
    unpacked > Math.max(size, 1) * MAX_RATIO
  )
    return refuse("archive_bomb");
  // An OOXML document with a macro project, or an archive that holds something runnable.
  if (entries.some((entry) => /(^|\/)vbaProject\.bin$/i.test(entry.name)))
    return refuse(/\.(docx|xlsx|pptx)$/i.test(name) ? "macro" : "archive_content");
  if (entries.some((entry) => RUNNABLE_NAMES.test(entry.name) || MACRO_NAMES.test(entry.name)))
    return refuse("archive_content");
  return null;
}

const HEAD = 64 * 1024;
const TAIL = 65_557;
const MAX_DIRECTORY = 8 * 1024 * 1024;

/**
 * The same intake rules for a file already in storage, without holding it in memory (plan
 * 14E.4): its first 64 KiB for what it is, its ZIP directory read by range, and for PDFs and
 * older Office files one streaming pass for active content (patterns may cross chunk borders).
 */
export async function intakeRefusalStored(
  size: number,
  name: string,
  range: (start: number, end: number) => Promise<Uint8Array>,
  whole: () => Promise<ReadableStream<Uint8Array>>,
): Promise<{ code: IntakeRefusal; reason: string } | null> {
  const refuse = (code: IntakeRefusal) => ({ code, reason: REASONS[code] });
  const head = await range(0, Math.min(size, HEAD));
  const quick = intakeRefusal(head, name);
  // A ZIP or PDF judged on its head alone is decided below on the whole file.
  const pdf = starts(head, 0x25, 0x50, 0x44, 0x46);
  const ole = starts(head, 0xd0, 0xcf, 0x11, 0xe0);
  const zip = starts(head, 0x50, 0x4b, 0x03, 0x04) || starts(head, 0x50, 0x4b, 0x05, 0x06);
  if (quick && !zip) return quick;
  if (zip) {
    const tailStart = Math.max(0, size - TAIL);
    const tail = await range(tailStart, size);
    const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
    let end = -1;
    for (let i = tail.length - 22; i >= 0; i -= 1) {
      if (view.getUint32(i, true) === 0x06054b50) {
        end = i;
        break;
      }
    }
    if (end < 0) return null; // not a readable archive: inert bytes
    const directorySize = view.getUint32(end + 12, true);
    const directoryAt = view.getUint32(end + 16, true);
    if (directorySize > MAX_DIRECTORY) return refuse("archive_bomb");
    if (directoryAt + directorySize > size) return null;
    const directory = await range(directoryAt, directoryAt + directorySize);
    // The directory followed by its end record, with the directory's offset rewritten to 0.
    const record = tail.subarray(end, Math.min(tail.length, end + 22));
    const joined = new Uint8Array(directory.length + record.length);
    joined.set(directory, 0);
    joined.set(record, directory.length);
    new DataView(joined.buffer).setUint32(directory.length + 16, 0, true);
    const entries = zipEntries(joined);
    return entries ? archiveRefusal(entries, size, name) : null;
  }
  if (!pdf && !ole) return null;
  const needles = pdf ? [ascii("/Launch"), ascii("/JavaScript")] : [VBA_STREAM];
  const keep = Math.max(...needles.map((n) => n.length)) - 1;
  const reader = (await whole()).getReader();
  let carry = new Uint8Array(0);
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const window = new Uint8Array(carry.length + value.length);
    window.set(carry, 0);
    window.set(value, carry.length);
    if (needles.some((needle) => contains(window, needle))) {
      await reader.cancel();
      return refuse(pdf ? "active_pdf" : "macro");
    }
    carry = window.subarray(Math.max(0, window.length - keep));
  }
  return null;
}
