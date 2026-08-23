import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  OcadeDatePicker,
  calendarCells,
  isoDate,
  parseIsoDate,
} from "@/components/ui/ocade-date-picker";

describe("OCADE date picker", () => {
  it("builds a stable six-week calendar grid and validates typed ISO dates", () => {
    const cells = calendarCells(new Date(Date.UTC(2026, 7, 1)));
    expect(cells).toHaveLength(42);
    expect(cells.some((cell) => cell.iso === "2026-08-28" && cell.inMonth)).toBe(true);
    expect(isoDate(parseIsoDate("2026-08-28")!)).toBe("2026-08-28");
    expect(parseIsoDate("2026-02-30")).toBeNull();
  });

  it("renders text inputs, a range, disabled bounds, Today, locale and optional time", () => {
    const html = renderToStaticMarkup(
      <OcadeDatePicker
        id="qa-window"
        label="QA window"
        value="2026-08-28"
        onChange={vi.fn()}
        endValue="2026-08-30"
        onEndChange={vi.fn()}
        min="2026-08-20"
        max="2026-09-05"
        locale="en-IN"
        includeTime
        time="08:28"
        onTimeChange={vi.fn()}
      />,
    );
    expect(html).toContain('role="grid"');
    expect(html).toContain("Start date");
    expect(html).toContain("End date");
    expect(html).toContain("Today");
    expect(html).toContain('type="time"');
    expect(html).toContain("28 August 2026");
    expect(html).toContain("disabled");
  });
});
