import { readFileSync } from "node:fs";
import { describe, expect, it, afterAll } from "vitest";
import { watchConsole } from "./support/expected-console";
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
    const underMore = readFileSync("src/routes/_authenticated/ocade.system.tsx", "utf8").includes(
      '"/ocade/code"',
    );
    const inPalette = readFileSync("src/components/shell/CommandPalette.tsx", "utf8").includes(
      '"/ocade/code"',
    );
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

/**
 * Console output this audit legitimately causes, classified rather than muted.
 *
 * The shared list in `support/expected-console.ts` says why each message is
 * correct behaviour. Anything NOT on it still reaches the console and fails the
 * assertion below, so a new error cannot hide inside expected noise.
 */
const consoleWatch = watchConsole();
afterAll(() => consoleWatch.restore());

describe("the console during this audit", () => {
  it("carries nothing this harness cannot account for", () => {
    expect(consoleWatch.unexpected.slice(0, 5)).toEqual([]);
  });
});

describe("what Code says about a repository it does not have", () => {
  const panel = source("src/components/ocade/CodeWorkspacePanel.tsx");

  it("computes what changed instead of tracking it separately", () => {
    /*
     * Status and diff both come from the workspace, so they cannot disagree
     * with each other or with the files on screen. A remembered copy of "what
     * is different" is a second thing to keep right, and the moment it drifts
     * the review pane describes a repository that does not exist.
     */
    expect(panel).toContain("workspaceStatus(workspace)");
    expect(panel).toContain("workspaceDiff(workspace)");
  });

  it("says plainly that branches, commits and CI need a host", () => {
    /*
     * The sentence is the host's own `unavailableReason`, rendered where those
     * controls would be — so there is one place that decides what is possible
     * and the screen cannot claim more than it. It appears with a repository
     * open, which is the only time the question arises.
     */
    expect(panel).toContain("repositoryHost.unavailableReason");
    expect(source("src/lib/code/git.ts")).toMatch(/status and diff below are computed/i);

    // And nothing pretends otherwise on the empty screen or anywhere else.
    const rendered = html();
    for (const fake of [">Commit<", ">Push<", ">Open pull request<", ">Create branch<"]) {
      expect(rendered, fake).not.toContain(fake);
    }
  });

  it("keeps sessions independent rather than replacing one with the next", () => {
    // A second intake used to destroy the first session's baseline, changes
    // and history, which exist nowhere else.
    expect(panel).toContain("const [sessions, setSessions]");
    expect(panel).toContain('role="tablist"');
    expect(panel).not.toMatch(/const \[workspace, setWorkspace\] = useState/);
  });
});
