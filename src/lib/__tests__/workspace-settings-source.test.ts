import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SETTINGS_GROUPS, findSection } from "../settings-sections";

const ROOT = process.cwd();

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("the unified settings workspace", () => {
  it("mounts the workspace shell exactly once for every settings route", () => {
    const childRoutes = [
      "settings.browser.tsx",
      "settings.mobile.tsx",
      "settings.skills.tsx",
      "settings.usage.tsx",
      "settings.voice.tsx",
    ];

    for (const file of childRoutes) {
      const text = source(`src/routes/_authenticated/${file}`);
      expect(text, file).not.toMatch(/components\/shell\/AppShell/);
      expect(text, file).not.toMatch(/<AppShell\b/);
    }

    expect(source("src/routes/_authenticated/settings.tsx")).toMatch(/<AppShell>/);
  });

  it("has a unique URL slug for every settings destination", () => {
    const slugs = SETTINGS_GROUPS.flatMap((group) => group.items.map((item) => item.slug));
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("backs every active setting with a dedicated route or implemented catchall panel", () => {
    const catchall = source("src/routes/_authenticated/settings.$section.tsx");
    for (const item of SETTINGS_GROUPS.flatMap((group) => group.items)) {
      if (item.status !== "active") continue;
      const routeFile =
        item.slug === ""
          ? "src/routes/_authenticated/settings.index.tsx"
          : `src/routes/_authenticated/settings.${item.slug}.tsx`;
      const implementedByRoute = existsSync(join(ROOT, routeFile));
      /*
       * A hyphenated slug MUST be a quoted key in the map — `local-engine:` is
       * not valid JavaScript unquoted. A pattern that only matches bare
       * identifiers therefore reports a correctly implemented section as
       * missing, which is the false-failure mode this file's sibling test
       * already warns about. Both forms are accepted.
       */
      const implementedByPanel = new RegExp(
        `(?:^|[\\s{"])"?${item.slug}"?:\\s*\\(\\)\\s*=>`,
        "m",
      ).test(catchall);
      expect(
        implementedByRoute || implementedByPanel,
        `${item.label} is marked active but has no implementation`,
      ).toBe(true);
    }
  });

  it.each(["work", "permissions", "connectors", "accessibility"])(
    "ships the required %s settings surface instead of a setup-only placeholder",
    (slug) => {
      expect(findSection(slug)?.item.status).toBe("active");
      expect(source("src/routes/_authenticated/settings.$section.tsx")).toMatch(
        new RegExp(`\\b${slug}:\\s*\\(\\)\\s*=>`),
      );
    },
  );

  it("does not nest a second main landmark inside the workspace main", () => {
    const settingsShell = source("src/components/settings/SettingsShell.tsx");
    expect(settingsShell).not.toMatch(/<main\b/);
    expect(settingsShell).toContain('aria-label="Settings content"');
  });

  it("does not advertise a feedback form that the Activity page does not provide", () => {
    expect(source("src/routes/_authenticated/settings.$section.tsx")).not.toMatch(
      /feedback form inside/i,
    );
  });

  it("rechecks saved Computer Use channels on each current execution surface", () => {
    const consumers = {
      "desktop actions": source("src/components/ocade/CopilotPanel.tsx"),
      "browser actions": source("src/routes/_authenticated/settings.browser.tsx"),
      "mobile actions": source("src/routes/_authenticated/settings.mobile.tsx"),
      "background automations": source("src/components/ocade/tasks/AutomationsWorkspace.tsx"),
    };
    expect(consumers["desktop actions"]).toContain('computerUseChannelDecision("thisComputer")');
    expect(consumers["browser actions"]).toContain('computerUseChannelDecision("webControl")');
    expect(consumers["mobile actions"]).toContain('computerUseChannelDecision("remoteSessions")');
    expect(consumers["background automations"]).toContain(
      'computerUseChannelDecision("backgroundTasks")',
    );
  });
});

describe("the responsive workspace shell", () => {
  const shell = source("src/components/shell/WorkspaceShell.tsx");

  it("provides an actual account menu rather than a single unlabeled account link", () => {
    expect(shell).toContain('aria-label="Account menu"');
    expect(shell).toContain('role="menu"');
  });

  it("renders a reachable mobile Copilot panel with explicit close semantics", () => {
    expect(shell).toContain('id="copilot-mobile-panel"');
    expect(shell).toContain('aria-modal="true"');
    expect(shell).toContain('aria-label="Close Copilot panel"');
  });

  it("exposes expanded state and control ownership on navigation toggles", () => {
    expect(shell).toContain("aria-expanded={mobileNavigation ? drawerOpen : !collapsed}");
    expect(shell).toContain('aria-controls="workspace-navigation"');
    expect(shell).toContain('id="workspace-navigation"');
  });
});
