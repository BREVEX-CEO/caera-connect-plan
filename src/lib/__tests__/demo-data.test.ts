import { describe, it, expect } from "vitest";
import * as demo from "../demo/data";

/**
 * Demo Mode fixtures.
 *
 * The risk with sample data is not that it is wrong — it is that it stops
 * looking like sample data. These fixtures are shown in a real UI, so they must
 * be internally consistent (ids unique, references resolvable, numbers adding
 * up) and must never contain anything that could be mistaken for a real person,
 * a real credential, or a live claim.
 *
 * The module docstring promises: "No real user or company exists behind these
 * records." These tests hold it to that.
 */

const collections = Object.entries(demo).filter(([, v]) => Array.isArray(v)) as Array<
  [string, ReadonlyArray<Record<string, unknown>>]
>;

describe("fixtures are present and well formed", () => {
  it("exports several sample collections", () => {
    expect(collections.length).toBeGreaterThan(3);
  });

  it("has no empty collection, which would render a blank demo screen", () => {
    for (const [name, rows] of collections) {
      expect(rows.length, name).toBeGreaterThan(0);
    }
  });

  it("gives every record in an id-bearing collection a UNIQUE id", () => {
    for (const [name, rows] of collections) {
      const ids = rows.map((r) => r.id).filter((id) => id !== undefined);
      if (ids.length === 0) continue;
      expect(new Set(ids).size, `${name} has duplicate ids`).toBe(ids.length);
    }
  });
});

describe("nothing can be mistaken for real or live data", () => {
  const blob = JSON.stringify(demo);

  it("carries no credential-shaped value", () => {
    expect(blob).not.toMatch(/sk-[A-Za-z0-9]{16,}/);
    expect(blob).not.toMatch(/AKIA[0-9A-Z]{16}/);
    expect(blob).not.toMatch(/-----BEGIN [A-Z ]*PRIVATE KEY-----/);
    expect(blob).not.toMatch(/\beyJ[A-Za-z0-9_-]{10,}\./); // JWT
  });

  it("carries no real-looking payment card number", () => {
    expect(blob).not.toMatch(/\b4\d{3}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/);
  });

  it("points at no external endpoint that demo mode might actually call", () => {
    // Demo Mode must not call anything; a URL here invites exactly that.
    expect(blob).not.toMatch(/https?:\/\//);
  });

  it("labels the sample company and its tax id as sample", () => {
    expect(demo.DEMO_COMPANY.name).toMatch(/sample/i);
    expect(demo.DEMO_COMPANY.gstin).toMatch(/sample/i);
  });

  it("uses an obviously non-production company id", () => {
    expect(demo.DEMO_COMPANY.id).toMatch(/^demo-/);
  });
});

describe("the demo conversation is honest about what it is", () => {
  const messages = demo.DEMO_OCADE_MESSAGES;

  it("alternates real chat roles", () => {
    for (const m of messages) expect(["assistant", "user"]).toContain(m.role);
    expect(messages.some((m) => m.role === "user")).toBe(true);
    expect(messages.some((m) => m.role === "assistant")).toBe(true);
  });

  it("states up front that no model is called", () => {
    const first = messages[0];
    expect(first.role).toBe("assistant");
    expect(first.content).toMatch(/demo mode/i);
    expect(first.content).toMatch(/won't call any model|no model/i);
  });

  it("labels a data-bearing answer as sample data", () => {
    // An assistant message quoting figures must not read as a real result.
    const withFigures = messages.filter(
      (m) => m.role === "assistant" && /\d/.test(m.content) && /invoice/i.test(m.content),
    );
    expect(withFigures.length).toBeGreaterThan(0);
    for (const m of withFigures) expect(m.content).toMatch(/sample data/i);
  });

  it("has no empty message", () => {
    for (const m of messages) expect(m.content.trim().length).toBeGreaterThan(0);
  });
});

describe("record shapes are internally consistent", () => {
  it("timesheet rows carry a date, person, project and positive hours", () => {
    for (const row of demo.DEMO_TIMESHEET) {
      expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(row.person.trim().length).toBeGreaterThan(0);
      expect(row.project.trim().length).toBeGreaterThan(0);
      expect(row.hours).toBeGreaterThan(0);
      expect(row.hours).toBeLessThanOrEqual(24);
    }
  });

  it("the sample resume has a name, headline and dated experience", () => {
    expect(demo.DEMO_RESUME.name.trim().length).toBeGreaterThan(0);
    expect(demo.DEMO_RESUME.headline.trim().length).toBeGreaterThan(0);
    expect(demo.DEMO_RESUME.experience.length).toBeGreaterThan(0);
    for (const job of demo.DEMO_RESUME.experience) {
      expect(job.role.trim().length).toBeGreaterThan(0);
      expect(job.company.trim().length).toBeGreaterThan(0);
      expect(job.period).toMatch(/\d{4}/);
    }
  });

  it("lists at least one skill on the sample resume", () => {
    expect(demo.DEMO_RESUME.skills.length).toBeGreaterThan(0);
  });
});
