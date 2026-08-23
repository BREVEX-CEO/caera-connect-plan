import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OcadeBanner } from "@/components/ui/ocade-banner";
import { OcadeDataTable } from "@/components/ui/ocade-data-table";
import { OcadeSkeleton } from "@/components/ui/ocade-skeleton";
import { DeviceAvatarEditor } from "@/components/settings/DeviceAvatarEditor";

describe("OCADE reusable design components", () => {
  it("renders structured, motion-aware skeletons and typed dismissible banners", () => {
    expect(renderToStaticMarkup(<OcadeSkeleton label="Loading status" lines={4} />)).toContain("motion-safe:animate-pulse");
    const banner = renderToStaticMarkup(<OcadeBanner title="Pre-launch" kind="warning" dismissible>Scope</OcadeBanner>);
    expect(banner).toContain("Dismiss Pre-launch");
    expect(banner).toContain("role=\"status\"");
  });

  it("renders responsive searchable sortable paginated tables with row actions", () => {
    const table = renderToStaticMarkup(<OcadeDataTable caption="Components" columns={[{ key: "name", label: "Name" }]} rows={[{ id: "1", name: "Website" }]} onAction={() => undefined} />);
    for (const value of ["Search table", "Sort by", "Ascending", "Actions", "Page 1 of 1", "Details"]) expect(table).toContain(value);
  });

  it("provides a device-only editable avatar and a truncating breadcrumb trail", () => {
    const avatar = renderToStaticMarkup(<DeviceAvatarEditor storageKey="test-avatar" initials="HA" />);
    for (const value of ["Select avatar", "PNG, JPEG or WebP", "device only", "Avatar initials"]) expect(avatar).toContain(value);
    const crumbs = readFileSync("src/components/ui/ocade-breadcrumbs.tsx", "utf8");
    for (const value of ["aria-current", "truncate", "aria-label=\"Breadcrumb\"", "aria-hidden"])
      expect(crumbs).toContain(value);
  });
});
