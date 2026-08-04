import { describe, it, expect } from "vitest";
import { CLINICAL_PACK, readDicomHeader, checkIdentifiers } from "../skills/packs/clinical-pack";

/**
 * Real DICOM bytes, assembled here element by element — 128-byte preamble,
 * DICM marker, an explicit-VR meta group with a genuine group length, then a
 * dataset in the declared encoding.
 *
 * The fixtures deliberately contain a made-up patient name so the tests can
 * prove the pack never emits it. That string must appear in the INPUT and never
 * in any output, which is the single most important property of this pack.
 */

const PATIENT_NAME = "DOE^JANE";

interface Elem {
  group: number;
  element: number;
  vr: string;
  value: string | number[];
}

const bytesOf = (v: string | number[]): number[] => {
  if (typeof v !== "string") return v;
  const out = [...v].map((c) => c.charCodeAt(0));
  if (out.length % 2 === 1) out.push(0x20); // DICOM pads text to even length
  return out;
};

function encodeExplicit(e: Elem): number[] {
  const value = bytesOf(e.value);
  return [
    e.group & 0xff,
    (e.group >> 8) & 0xff,
    e.element & 0xff,
    (e.element >> 8) & 0xff,
    e.vr.charCodeAt(0),
    e.vr.charCodeAt(1),
    value.length & 0xff,
    (value.length >> 8) & 0xff,
    ...value,
  ];
}

function encodeImplicit(e: Elem): number[] {
  const value = bytesOf(e.value);
  return [
    e.group & 0xff,
    (e.group >> 8) & 0xff,
    e.element & 0xff,
    (e.element >> 8) & 0xff,
    value.length & 0xff,
    (value.length >> 8) & 0xff,
    (value.length >> 16) & 0xff,
    (value.length >> 24) & 0xff,
    ...value,
  ];
}

const IMPLICIT_LE = "1.2.840.10008.1.2";
const EXPLICIT_LE = "1.2.840.10008.1.2.1";

function dicom(dataset: Elem[], transferSyntax = EXPLICIT_LE, preambleFill = 0): Uint8Array {
  const metaAfterLength = encodeExplicit({
    group: 0x0002,
    element: 0x0010,
    vr: "UI",
    value: transferSyntax,
  });

  const groupLength = metaAfterLength.length;
  const lengthElement = encodeExplicit({
    group: 0x0002,
    element: 0x0000,
    vr: "UL",
    value: [
      groupLength & 0xff,
      (groupLength >> 8) & 0xff,
      (groupLength >> 16) & 0xff,
      (groupLength >> 24) & 0xff,
    ],
  });

  const encode = transferSyntax === IMPLICIT_LE ? encodeImplicit : encodeExplicit;

  return Uint8Array.from([
    ...Array(128).fill(preambleFill),
    0x44,
    0x49,
    0x43,
    0x4d, // "DICM"
    ...lengthElement,
    ...metaAfterLength,
    ...dataset.flatMap(encode),
  ]);
}

const IDENTIFIED = dicom([
  { group: 0x0008, element: 0x0060, vr: "CS", value: "CT" },
  { group: 0x0010, element: 0x0010, vr: "PN", value: PATIENT_NAME },
  { group: 0x0010, element: 0x0020, vr: "LO", value: "MRN0012345" },
  { group: 0x0010, element: 0x0030, vr: "DA", value: "19850612" },
  { group: 0x0018, element: 0x0015, vr: "CS", value: "HEAD" },
]);

/** The same scan after a correct de-identification: tags present, emptied. */
const DEIDENTIFIED = dicom([
  { group: 0x0008, element: 0x0060, vr: "CS", value: "CT" },
  { group: 0x0010, element: 0x0010, vr: "PN", value: "" },
  { group: 0x0010, element: 0x0020, vr: "LO", value: "" },
  { group: 0x0018, element: 0x0015, vr: "CS", value: "HEAD" },
]);

describe("the pack states its own limits", () => {
  it("says plainly what it cannot do, including de-identifying", () => {
    expect(CLINICAL_PACK.coverageNote).toMatch(/cannot open a PACS/i);
    expect(CLINICAL_PACK.coverageNote).toMatch(/interpret a scan/i);
    expect(CLINICAL_PACK.coverageNote).toMatch(/de-identification is governed work/i);
  });
});

describe("recognising a DICOM file", () => {
  it("reads a real header and reports the technical fields", () => {
    const r = readDicomHeader(IDENTIFIED);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.technical.Modality).toBe("CT");
    expect(r.data.technical["Body part examined"]).toBe("HEAD");
    expect(r.data.transferSyntax).toBe(EXPLICIT_LE);
  });

  /**
   * The marker is at offset 128, after a preamble that may legally hold
   * anything. Identifying by the file's first bytes — what a naive check does —
   * would reject this valid file.
   */
  it("finds the marker after a non-zero preamble", () => {
    const r = readDicomHeader(
      dicom([{ group: 0x0008, element: 0x0060, vr: "CS", value: "MR" }], EXPLICIT_LE, 0x41),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.technical.Modality).toBe("MR");
  });

  it("reads an implicit-VR dataset, where elements carry no VR", () => {
    const implicit = dicom(
      [
        { group: 0x0008, element: 0x0060, vr: "CS", value: "US" },
        { group: 0x0010, element: 0x0010, vr: "PN", value: PATIENT_NAME },
      ],
      IMPLICIT_LE,
    );
    const r = readDicomHeader(implicit);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.technical.Modality).toBe("US");
  });

  it("refuses a file with no DICM marker rather than guessing", () => {
    const r = readDicomHeader(Uint8Array.from(Array(200).fill(0)));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/won't guess from the file name/i);
  });

  it("refuses a file too short to hold a header", () => {
    expect(readDicomHeader(Uint8Array.from([0x44, 0x49, 0x43, 0x4d])).ok).toBe(false);
  });

  it("refuses a transfer syntax it hasn't been tested against", () => {
    const bigEndian = dicom(
      [{ group: 0x0008, element: 0x0060, vr: "CS", value: "CT" }],
      "1.2.840.10008.1.2.2",
    );
    const r = readDicomHeader(bigEndian);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/Big Endian/i);
    expect(r.reason).toMatch(/may have misread/i);
  });

  it("refuses a truncated file rather than reporting a partial header", () => {
    const r = readDicomHeader(IDENTIFIED.slice(0, IDENTIFIED.length - 6));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/truncated|runs past the end/i);
  });
});

describe("checking whether a scan still identifies the patient", () => {
  it("finds every populated identifying field", () => {
    const r = checkIdentifiers(IDENTIFIED);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.populatedCount).toBe(3);
    expect(r.data.findings.map((f) => f.label).sort()).toEqual([
      "Date of birth",
      "Patient ID",
      "Patient name",
    ]);
  });

  /**
   * THE test this pack exists for. A tool that answers "is there patient data
   * in here?" by printing the patient's name has copied the identifier into a
   * new place — a receipt, a console, a ticket — which is the exact harm the
   * check was run to prevent.
   */
  it("never emits the contents of an identifying field", () => {
    const r = checkIdentifiers(IDENTIFIED);
    if (!r.ok) throw new Error("unreachable");

    const everythingItSaid = JSON.stringify(r);
    expect(everythingItSaid).not.toContain(PATIENT_NAME);
    expect(everythingItSaid).not.toContain("DOE");
    expect(everythingItSaid).not.toContain("JANE");
    expect(everythingItSaid).not.toContain("MRN0012345");
    expect(everythingItSaid).not.toContain("19850612");

    // It still says enough to act on.
    expect(r.evidence).toMatch(/Patient name/);
    expect(r.evidence).toMatch(/has not shown you their contents/i);
  });

  it("reports byte length so a filled field is visible without its value", () => {
    const r = checkIdentifiers(IDENTIFIED);
    if (!r.ok) throw new Error("unreachable");
    const name = r.data.findings.find((f) => f.label === "Patient name")!;
    expect(name.byteLength).toBe(PATIENT_NAME.length);
    expect(name.populated).toBe(true);
  });

  /** A correctly de-identified file keeps the tags and empties them. */
  it("recognises emptied tags as not populated", () => {
    const r = checkIdentifiers(DEIDENTIFIED);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.populatedCount).toBe(0);
    expect(r.data.findings).toHaveLength(2);
    expect(r.data.findings.every((f) => !f.populated)).toBe(true);
  });

  /**
   * A clean result must not read as a certificate. Burned-in text and private
   * tags are outside what this check covers, and someone about to share a file
   * needs to know that before they do.
   */
  it("does not let a clean result imply a full audit", () => {
    const r = checkIdentifiers(DEIDENTIFIED);
    if (!r.ok) throw new Error("unreachable");
    expect(r.evidence).toMatch(/not a full de-identification audit/i);
    expect(r.evidence).toMatch(/burned into the image/i);
    expect(r.data.checkedTagCount).toBeGreaterThan(10);
  });

  it("refuses to act as a de-identifier", () => {
    const r = checkIdentifiers(IDENTIFIED);
    if (!r.ok) throw new Error("unreachable");
    expect(r.evidence).toMatch(/won't remove them/i);
    expect(r.evidence).toMatch(/approved de-identification tool/i);
    // The pack must not offer any mutating capability at all.
    expect(CLINICAL_PACK.capabilities.every((c) => !c.mutating)).toBe(true);
  });

  it("works on an implicit-VR file too", () => {
    const implicit = dicom(
      [
        { group: 0x0010, element: 0x0010, vr: "PN", value: PATIENT_NAME },
        { group: 0x0008, element: 0x0080, vr: "LO", value: "ST ELSEWHERE" },
      ],
      IMPLICIT_LE,
    );
    const r = checkIdentifiers(implicit);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.populatedCount).toBe(2);
    expect(JSON.stringify(r)).not.toContain("ELSEWHERE");
  });

  it("carries a parse refusal through instead of reporting a clean file", () => {
    const r = checkIdentifiers(Uint8Array.from(Array(200).fill(0)));
    expect(r.ok).toBe(false);
  });
});
