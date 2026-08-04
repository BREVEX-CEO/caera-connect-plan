/**
 * Clinical-imaging skill pack — a REAL, executed adapter for the healthcare
 * category.
 *
 * Scope, stated plainly: this pack reads the **header** of a DICOM file to
 * answer one question — *does this still identify a patient?* It does not open
 * a PACS, does not decode or display pixel data, does not diagnose anything,
 * and never de-identifies a file itself. `coverageNote` says so.
 *
 * The rule that governs every line below: **it never returns the value of an
 * identifying field.** Not in the result, not in the evidence string, not in a
 * log. A tool that answers "is there patient data in here?" by printing the
 * patient's name has copied the identifier into somewhere new — a receipt, a
 * console, an audit record — which is the precise harm it was run to prevent.
 * Presence, length and tag name are enough to act on.
 *
 * De-identification itself is deliberately absent. Stripping tags correctly is
 * governed work (DICOM PS3.15 profiles, and local policy on top), and a
 * half-correct strip that *looks* successful is worse than no strip at all,
 * because the file then gets shared.
 */
import type { SkillCapability, SkillPack } from "../skill-pack";

const CAPABILITIES: SkillCapability[] = [
  {
    id: "clinical.identify",
    label: "Confirm a file really is a DICOM image",
    methods: ["file"],
    mutating: false,
    verifyBy: "file",
    tested: true,
  },
  {
    id: "clinical.check_identifiers",
    label: "Check whether a scan still identifies the patient",
    methods: ["file"],
    mutating: false,
    verifyBy: "file",
    tested: true,
  },
];

export const CLINICAL_PACK: SkillPack = {
  appId: "ocade.clinical",
  displayName: "Medical imaging files",
  category: "healthcare_imaging",
  // Pinned to the DICOM standard's file-format version, which is what is
  // implemented here — not to any vendor's PACS.
  testedVersions: ["3."],
  capabilities: CAPABILITIES,
  requiresLicensedInstall: false,
  coverageNote:
    "Reads DICOM file headers to check for patient identifiers. OCADE cannot open a PACS, view or decode images, interpret a scan, or remove identifiers — de-identification is governed work and must be done with an approved tool.",
};

export type ClinicalOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

/* ------------------------------------------------------------- constants -- */

const PREAMBLE = 128;

/** Explicit-VR types whose length field is 4 bytes after 2 reserved ones. */
const LONG_FORM_VR = new Set(["OB", "OW", "OF", "OD", "OL", "SQ", "UT", "UN", "UC", "UR"]);

const UID_IMPLICIT_VR_LE = "1.2.840.10008.1.2";
const UID_EXPLICIT_VR_BE = "1.2.840.10008.1.2.2";

/**
 * Tags that identify a patient, from DICOM PS3.15 Annex E (the Basic
 * Application Level Confidentiality Profile). This is a working subset, not the
 * complete list — `checkIdentifiers` says so in its own result rather than
 * letting a clean report imply the file was fully audited.
 */
const IDENTIFYING_TAGS: Record<string, string> = {
  "0010,0010": "Patient name",
  "0010,0020": "Patient ID",
  "0010,0030": "Date of birth",
  "0010,0032": "Time of birth",
  "0010,0040": "Sex",
  "0010,1000": "Other patient IDs",
  "0010,1001": "Other patient names",
  "0010,1040": "Patient address",
  "0010,2154": "Patient telephone",
  "0010,2160": "Ethnic group",
  "0008,0090": "Referring physician",
  "0008,1048": "Physician of record",
  "0008,1050": "Performing physician",
  "0008,1070": "Operator name",
  "0008,0080": "Institution name",
  "0008,0081": "Institution address",
  "0008,1010": "Station name",
  "0038,0300": "Current patient location",
  "0040,A123": "Person name",
};

/** Tags that are safe to report the value of — they identify the scan, not the person. */
const TECHNICAL_TAGS: Record<string, string> = {
  "0008,0060": "Modality",
  "0018,0015": "Body part examined",
  "0008,0070": "Manufacturer",
};

/* --------------------------------------------------------------- parsing -- */

interface Element {
  tag: string;
  vr: string | null;
  length: number;
  valueOffset: number;
}

const tagKey = (group: number, element: number) =>
  `${group.toString(16).padStart(4, "0").toUpperCase()},${element.toString(16).padStart(4, "0").toUpperCase()}`;

function readElements(
  b: Uint8Array,
  view: DataView,
  start: number,
  end: number,
  explicitVr: boolean,
): ClinicalOutcome<Element[]> {
  const out: Element[] = [];
  let i = start;

  while (i + 8 <= end) {
    const group = view.getUint16(i, true);
    const element = view.getUint16(i + 2, true);
    let vr: string | null = null;
    let length: number;
    let valueOffset: number;

    if (explicitVr) {
      vr = String.fromCharCode(b[i + 4], b[i + 5]);
      if (!/^[A-Z]{2}$/.test(vr)) {
        return {
          ok: false,
          reason:
            "This file's element structure doesn't match its declared encoding — it may be corrupt or use a transfer syntax OCADE hasn't been tested with.",
        };
      }
      if (LONG_FORM_VR.has(vr)) {
        if (i + 12 > end) break;
        length = view.getUint32(i + 8, true);
        valueOffset = i + 12;
      } else {
        length = view.getUint16(i + 6, true);
        valueOffset = i + 8;
      }
    } else {
      length = view.getUint32(i + 4, true);
      valueOffset = i + 8;
    }

    // Undefined length means a nested sequence whose end is marked by a
    // delimiter. Walking it correctly is real work; guessing past it would
    // misread every element after, so the file is refused instead.
    if (length === 0xffffffff) {
      return {
        ok: false,
        reason:
          "This file contains a nested sequence of undefined length. OCADE hasn't been tested against those and won't report on a header it may have misread.",
      };
    }
    if (length < 0 || valueOffset + length > end) {
      return {
        ok: false,
        reason: "This file's header runs past the end of the file — it's truncated.",
      };
    }

    out.push({ tag: tagKey(group, element), vr, length, valueOffset });
    // Odd lengths are padded to even boundaries.
    i = valueOffset + length + (length % 2);
  }

  // Bytes left over that are too few to form an element mean the last one was
  // cut off. Stopping quietly here would report a header that is missing
  // whatever was in the truncated tail — including, possibly, an identifier.
  if (i < end) {
    return {
      ok: false,
      reason: "This file's header runs past the end of the file — it's truncated.",
    };
  }

  return { ok: true, data: out, evidence: `${out.length} header elements.` };
}

function textValue(b: Uint8Array, el: Element): string {
  let s = "";
  for (let i = el.valueOffset; i < el.valueOffset + el.length; i++) s += String.fromCharCode(b[i]);
  return s.replace(/\0+$/, "").trim();
}

export interface DicomHeader {
  transferSyntax: string;
  /** Values from technical tags only — never anything that identifies a person. */
  technical: Record<string, string>;
  elementCount: number;
}

interface ParsedFile {
  transferSyntax: string;
  metaElements: Element[];
  dataset: Element[];
}

/**
 * Parse a DICOM file into its meta group and its dataset.
 *
 * The meta group is ALWAYS Explicit VR Little Endian and the dataset may not
 * be, so the boundary between them has to be found before either is read.
 * (0002,0000) holds the meta group's byte count and is always the first
 * element; reading to end-of-file instead would parse an implicit-VR dataset
 * with explicit-VR rules and produce nonsense.
 */
function parseDicom(bytes: Uint8Array): ClinicalOutcome<ParsedFile> {
  if (bytes.length < PREAMBLE + 4) {
    return { ok: false, reason: "This file is too short to be a DICOM image." };
  }
  const magic = String.fromCharCode(
    bytes[PREAMBLE],
    bytes[PREAMBLE + 1],
    bytes[PREAMBLE + 2],
    bytes[PREAMBLE + 3],
  );
  if (magic !== "DICM") {
    return {
      ok: false,
      reason:
        "This isn't a DICOM file — it has no DICM marker after the preamble. OCADE won't guess from the file name.",
    };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const metaStart = PREAMBLE + 4;

  // (0002,0000) is UL with a 4-byte value: 8 bytes of header, 4 of value.
  const GROUP_LENGTH_SIZE = 12;
  if (metaStart + GROUP_LENGTH_SIZE > bytes.length) {
    return { ok: false, reason: "This file ends before its meta group — it's truncated." };
  }
  if (
    view.getUint16(metaStart, true) !== 0x0002 ||
    view.getUint16(metaStart + 2, true) !== 0x0000
  ) {
    return {
      ok: false,
      reason:
        "This file's meta group doesn't start with a group length, so OCADE can't find where the image data begins.",
    };
  }

  const groupLength = view.getUint32(metaStart + 8, true);
  const metaEnd = metaStart + GROUP_LENGTH_SIZE + groupLength;
  if (metaEnd > bytes.length) {
    return {
      ok: false,
      reason: "This file's meta group claims to be longer than the file — it's truncated.",
    };
  }

  const meta = readElements(bytes, view, metaStart + GROUP_LENGTH_SIZE, metaEnd, true);
  if (!meta.ok) return meta;

  const syntaxEl = meta.data.find((e) => e.tag === "0002,0010");
  const transferSyntax = syntaxEl ? textValue(bytes, syntaxEl) : "";
  if (!transferSyntax) {
    return {
      ok: false,
      reason: "This file doesn't declare a transfer syntax, so OCADE can't know how to read it.",
    };
  }
  if (transferSyntax === UID_EXPLICIT_VR_BE) {
    return {
      ok: false,
      reason:
        "This file uses Explicit VR Big Endian, which OCADE hasn't been tested against. It won't report on a header it may have misread.",
    };
  }

  const dataset = readElements(
    bytes,
    view,
    metaEnd,
    bytes.length,
    transferSyntax !== UID_IMPLICIT_VR_LE,
  );
  if (!dataset.ok) return dataset;

  return {
    ok: true,
    data: { transferSyntax, metaElements: meta.data, dataset: dataset.data },
    evidence: `${meta.data.length} meta and ${dataset.data.length} data elements.`,
  };
}

/**
 * Confirm a file is DICOM and read its non-identifying header fields.
 *
 * The magic bytes sit at offset 128, after a preamble that is usually zeros but
 * may legally contain anything — so a file cannot be identified by its first
 * bytes, which is what a naive check would do.
 */
export function readDicomHeader(bytes: Uint8Array): ClinicalOutcome<DicomHeader> {
  const parsed = parseDicom(bytes);
  if (!parsed.ok) return parsed;

  const technical: Record<string, string> = {};
  for (const el of parsed.data.dataset) {
    const label = TECHNICAL_TAGS[el.tag];
    if (label) technical[label] = textValue(bytes, el);
  }

  return {
    ok: true,
    data: {
      transferSyntax: parsed.data.transferSyntax,
      technical,
      elementCount: parsed.data.metaElements.length + parsed.data.dataset.length,
    },
    evidence: `DICOM file, ${parsed.data.dataset.length} data elements${technical.Modality ? `, modality ${technical.Modality}` : ""}.`,
  };
}

/* ----------------------------------------------------------- identifiers -- */

export interface IdentifierFinding {
  tag: string;
  /** What the field is, e.g. "Patient name". Never its contents. */
  label: string;
  /** True when the field is present AND non-empty. */
  populated: boolean;
  /** Byte length only — enough to see a field is filled, not what it says. */
  byteLength: number;
}

export interface IdentifierReport {
  findings: IdentifierFinding[];
  populatedCount: number;
  /** Honest scope marker: a clean result is not a certificate. */
  checkedTagCount: number;
}

/**
 * Report which identifying fields are still populated.
 *
 * Returns tag names and byte lengths only. See the module header for why the
 * values are never returned — including in the evidence line, which is the one
 * most likely to end up pasted into a ticket.
 */
export function checkIdentifiers(bytes: Uint8Array): ClinicalOutcome<IdentifierReport> {
  const parsed = parseDicom(bytes);
  if (!parsed.ok) return parsed;

  const findings: IdentifierFinding[] = [];
  for (const el of parsed.data.dataset) {
    const label = IDENTIFYING_TAGS[el.tag];
    if (!label) continue;
    // Length alone, deliberately. A zero-length tag is present but emptied,
    // which is what a correct de-identification looks like.
    findings.push({ tag: el.tag, label, populated: el.length > 0, byteLength: el.length });
  }

  const populated = findings.filter((f) => f.populated);
  const checkedTagCount = Object.keys(IDENTIFYING_TAGS).length;

  return {
    ok: true,
    data: { findings, populatedCount: populated.length, checkedTagCount },
    evidence:
      populated.length === 0
        ? `No identifying fields are populated, out of the ${checkedTagCount} OCADE checks. That is not a full de-identification audit — other tags, private tags and text burned into the image itself are not covered.`
        : `${populated.length} identifying field${populated.length === 1 ? " is" : "s are"} still filled in: ${populated.map((p) => p.label).join(", ")}. OCADE has not shown you their contents, and won't remove them — use an approved de-identification tool.`,
  };
}
