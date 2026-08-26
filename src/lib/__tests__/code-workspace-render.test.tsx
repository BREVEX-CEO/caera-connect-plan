import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CodeWorkspacePanel } from "@/components/ocade/CodeWorkspacePanel";
import { MODULE_CONTEXT } from "../shell-nav";

const html = () => renderToStaticMarkup(<CodeWorkspacePanel />);
const source = (path: string) => readFileSync(path, "utf8");

describe("the Code workspace is a reachable product surface", () => {
  it("is reachable from OCADE, on the rail or under More", () => {
    /*
     * THIS USED TO REQUIRE A SIDEBAR ENTRY. The rail went from twelve
     * destinations to seven, which is the point of the change: a list of twelve
     * rooms is a sitemap, not a place to work. What must stay true is that the
     * screen has a route a person can follow — the rail, the More page, or the
     * command palette.
     */
    const onRail = MODULE_CONTEXT.ocade.some((item) => item.to === "/ocade/code");
    const underMore = readFileSync("src/routes/_authenticated/ocade.system.tsx", "utf8").includes('"/ocade/code"');
    const inPalette = readFileSync("src/components/shell/CommandPalette.tsx", "utf8").includes('"/ocade/code"');
    expect(onRail || underMore || inPalette).toBe(true);
    expect(source("src/routes/_authenticated/ocade.code.tsx")).toContain("<CodeWorkspacePanel />");
  });

  it("renders repository intake and an honest empty state", () => {
    const rendered = html();
    expect(rendered).toContain("Select folder");
    expect(rendered).toContain("Load temporary sample");
    expect(rendered).toContain("No repository loaded");
    expect(rendered).toContain("does not write the selected directory");
  });

  it("does not render fake terminal success before a host observation", () => {
    const rendered = html();
    expect(rendered).not.toContain("exit 0");
    expect(rendered).not.toContain("tests passed");
    expect(rendered).not.toContain("build succeeded");
  });
});

describe("the Code source keeps host execution and artifacts explicit", () => {
  const panel = source("src/components/ocade/CodeWorkspacePanel.tsx");
  const runtime = source("src/lib/code/workspace.ts");

  it("routes test/build requests through the observed command-host contract", () => {
    expect(panel).toContain("runWorkspaceCommand(workspace, command, unavailableHost)");
    expect(panel).toContain("will not simulate terminal output");
    expect(runtime).toContain("observation.data.observed && observation.data.exitCode === 0");
    expect(runtime).toContain("No success receipt was recorded");
  });

  it("creates patch artifacts only after a verified reversible workspace change", () => {
    expect(panel).toContain("latestChange.undoVerified");
    expect(panel).toContain('kind: "patch"');
    expect(panel).toContain("content: latestChange.patchText");
    expect(panel).toContain("latestChange.beforeSha256");
    expect(panel).toContain("latestChange.afterSha256");
  });

  it("removes only the browser-selected directory root from repository-relative paths", () => {
    expect(panel).toContain("hasSharedSelectionRoot");
    expect(panel).toContain("slice(`${selectedRoot}/`.length)");
  });
});
