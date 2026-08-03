/**
 * Client-side resume export helpers.
 * - PDF: browser print of the preview page (native, no server, deterministic).
 * - DOCX: assembled with the `docx` package, downloaded as a Blob.
 */
import { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType } from "docx";
import type { ResumeContent } from "./madee-resume-types";

function fileNameSafe(s: string) {
  return s.replace(/[^\w\d\-_. ]+/g, "").trim() || "resume";
}

export function exportPdfViaPrint() {
  // The preview route wires a print-optimised layout; window.print emits a
  // real PDF via the browser's "Save as PDF" destination. No server round-trip.
  window.print();
}

export async function exportDocx(title: string, r: ResumeContent) {
  const paragraphs: Paragraph[] = [];

  if (r.personal.fullName) {
    paragraphs.push(
      new Paragraph({
        text: r.personal.fullName,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
      }),
    );
  }
  if (r.personal.headline) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: r.personal.headline, italics: true })],
      }),
    );
  }
  const contact = [r.personal.email, r.personal.phone, r.personal.location, r.personal.website]
    .filter(Boolean)
    .join(" • ");
  if (contact) {
    paragraphs.push(
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(contact)] }),
    );
  }

  const section = (label: string) => {
    paragraphs.push(new Paragraph({ text: label, heading: HeadingLevel.HEADING_2 }));
  };
  const bullet = (t: string) => new Paragraph({ text: t, bullet: { level: 0 } });

  if (r.summary?.trim()) {
    section("Summary");
    paragraphs.push(new Paragraph({ text: r.summary }));
  }

  if (r.work.length) {
    section("Experience");
    for (const w of r.work) {
      const header = [w.role, w.company].filter(Boolean).join(" — ");
      const range = [w.start, w.current ? "Present" : w.end].filter(Boolean).join(" – ");
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: header, bold: true }),
            ...(range ? [new TextRun({ text: `  (${range})` })] : []),
          ],
        }),
      );
      if (w.location) paragraphs.push(new Paragraph({ text: w.location }));
      for (const b of w.bullets.filter(Boolean)) paragraphs.push(bullet(b));
    }
  }

  if (r.education.length) {
    section("Education");
    for (const e of r.education) {
      const header = [e.degree, e.field].filter(Boolean).join(", ");
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: e.school, bold: true }),
            ...(header ? [new TextRun({ text: ` — ${header}` })] : []),
          ],
        }),
      );
      const range = [e.start, e.end].filter(Boolean).join(" – ");
      if (range) paragraphs.push(new Paragraph({ text: range }));
      if (e.notes) paragraphs.push(new Paragraph({ text: e.notes }));
    }
  }

  if (r.skills.length) {
    section("Skills");
    paragraphs.push(new Paragraph({ text: r.skills.filter(Boolean).join(" • ") }));
  }

  if (r.projects.length) {
    section("Projects");
    for (const p of r.projects) {
      const head = [p.name, p.role].filter(Boolean).join(" — ");
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: head, bold: true })] }));
      if (p.link) paragraphs.push(new Paragraph({ text: p.link }));
      for (const b of p.bullets.filter(Boolean)) paragraphs.push(bullet(b));
    }
  }

  if (r.certifications.length) {
    section("Certifications");
    for (const c of r.certifications) {
      const line = [c.name, c.issuer, c.date].filter(Boolean).join(" — ");
      paragraphs.push(new Paragraph({ text: line || " " }));
    }
  }

  if (r.achievements.length) {
    section("Achievements");
    for (const a of r.achievements.filter(Boolean)) paragraphs.push(bullet(a));
  }

  if (r.languages.length) {
    section("Languages");
    paragraphs.push(
      new Paragraph({
        text: r.languages
          .filter((l) => l.name)
          .map((l) => `${l.name} (${l.proficiency})`)
          .join(" • "),
      }),
    );
  }

  if (r.links.length) {
    section("Links");
    for (const l of r.links) {
      const line = [l.label, l.url].filter(Boolean).join(": ");
      if (line) paragraphs.push(new Paragraph({ text: line }));
    }
  }

  const doc = new Document({ sections: [{ children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileNameSafe(title)}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}
