import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CodeWorkspacePanel } from "@/components/ocade/CodeWorkspacePanel";
import { MODULE_CONTEXT } from "../shell-nav";

const html = () => renderToStaticMarkup(<CodeWorkspacePanel />);
const source = (path: string) => readFileSync(path, "utf8");

describe("the Code workspace is a reachable product surface", () => {
  it("has a real OCADE navigation entry and route", () => {
    const entry = MODULE_CONTEXT.ocade.find((item) => item.to === "/ocade/code");
    expect(entry).toBeDefined();
    expect(entry?.label).toBe("Code");
    expect(entry?.planned).toBeUndefined();
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
