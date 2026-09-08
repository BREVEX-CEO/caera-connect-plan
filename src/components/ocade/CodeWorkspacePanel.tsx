import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCode2,
  FolderOpen,
  GitBranch,
  Play,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Terminal,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GlassPanel } from "@/components/shell/GlassPanel";
import {
  analyseWorkspace,
  applicableInstructions,
  applyCodePatch,
  createCodeWorkspace,
  previewCodePatch,
  runWorkspaceCommand,
  searchWorkspaceReferences,
  searchWorkspaceSymbol,
  searchWorkspaceText,
  undoCodeChange,
  type CodeCommand,
  type CodeCommandHost,
  type CodeWorkspace,
  type PatchPreview,
  type WorkspaceAnalysis,
} from "@/lib/code/workspace";
import { validateGeneratedSandboxRequest } from "@/lib/code/generated-sandbox";
import { saveArtifact } from "@/lib/artifacts/store";
import { runSandboxScript, type SandboxRunResponse } from "@/lib/sandbox.functions";

const SAMPLE_FILES = [
  {
    path: "AGENTS.md",
    content: "Keep edits minimal.\nRun focused tests before the full suite.\n",
  },
  {
    path: "src/greet.ts",
    content: ["export function greet(name: string) {", '  return "hi " + name;', "}", ""].join(
      "\n",
    ),
  },
  {
    path: "src/greet.test.ts",
    content: 'import { greet } from "./greet";\nexport const expected = greet("Ada");\n',
  },
  {
    path: "package.json",
    content: JSON.stringify(
      { name: "ocade-temporary-repository", scripts: { test: "vitest run", build: "vite build" } },
      null,
      2,
    ),
  },
];

const SAMPLE_DIFF = [
  "--- a/src/greet.ts",
  "+++ b/src/greet.ts",
  "@@ -1,3 +1,3 @@",
  " export function greet(name: string) {",
  '-  return "hi " + name;',
  "+  return `Hello, ${name}`;",
  " }",
  "",
].join("\n");

const TEXT_NAMES = new Set([
  "agents.md",
  "readme",
  "readme.md",
  "license",
  "dockerfile",
  "makefile",
  ".gitignore",
  ".npmrc",
  ".editorconfig",
]);
const TEXT_EXTENSIONS = new Set([
  "c",
  "cc",
  "cpp",
  "cs",
  "css",
  "diff",
  "env",
  "go",
  "graphql",
  "h",
  "hpp",
  "html",
  "java",
  "js",
  "json",
  "jsx",
  "kt",
  "kts",
  "md",
  "mjs",
  "mts",
  "patch",
  "php",
  "properties",
  "py",
  "rb",
  "rs",
  "scss",
  "sh",
  "sql",
  "swift",
  "toml",
  "ts",
  "tsx",
  "txt",
  "xml",
  "yaml",
  "yml",
]);

type SearchView =
  | { kind: "none" }
  | { kind: "error"; message: string }
  | {
      kind: "results";
      evidence: string;
      rows: Array<{ path: string; line: number; text: string }>;
    };

const unavailableHost: CodeCommandHost = {
  id: "desktop-companion",
  kind: "unavailable",
  unavailableReason:
    "A verified desktop command host is not connected. OCADE will not simulate terminal output; connect the desktop companion after its Code command capability is installed and approved.",
  async run() {
    throw new Error("Unavailable hosts must never be dispatched.");
  },
};

function isTextRepositoryFile(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  const name = normalized.split("/").at(-1) ?? "";
  if (TEXT_NAMES.has(name)) return true;
  const extension = name.includes(".") ? (name.split(".").at(-1) ?? "") : "";
  return TEXT_EXTENSIONS.has(extension);
}

function download(name: string, content: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CodeWorkspacePanel() {
  const runSandbox = useServerFn(runSandboxScript);
  const [sandboxRunning, setSandboxRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [workspace, setWorkspace] = useState<CodeWorkspace | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<WorkspaceAnalysis | null>(null);
  const [analysisEvidence, setAnalysisEvidence] = useState("");
  const [diff, setDiff] = useState(SAMPLE_DIFF);
  const [preview, setPreview] = useState<PatchPreview | null>(null);
  const [searchMode, setSearchMode] = useState<"text" | "symbol" | "references">("text");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchView, setSearchView] = useState<SearchView>({ kind: "none" });
  const [command, setCommand] = useState<CodeCommand>("test");
  const [generatedScript, setGeneratedScript] = useState(
    'const input = await sandbox.readText("source.txt");\nawait sandbox.writeText("result.txt", input.toUpperCase());',
  );
  const [sandboxStatus, setSandboxStatus] = useState<string | null>(null);
  const [terminal, setTerminal] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedFile = useMemo(
    () => workspace?.files.find((file) => file.path === selectedPath) ?? null,
    [selectedPath, workspace],
  );
  const instructions = useMemo(
    () => (workspace && selectedPath ? applicableInstructions(workspace, selectedPath) : []),
    [selectedPath, workspace],
  );
  const activeChanges = workspace?.changes.filter((change) => change.status === "applied") ?? [];
  const latestChange = activeChanges.at(-1) ?? null;

  function installWorkspace(next: CodeWorkspace) {
    setWorkspace(next);
    setSelectedPath(
      next.files.find((file) => file.path.endsWith(".ts"))?.path ?? next.files[0].path,
    );
    setAnalysis(null);
    setAnalysisEvidence("");
    setPreview(null);
    setSearchView({ kind: "none" });
    setError(null);
    setTerminal((lines) => [
      ...lines,
      `repository: ${next.name} · ${next.files.length} text files · session memory only`,
    ]);
  }

  function loadSample() {
    const created = createCodeWorkspace({
      name: "Temporary greeting repository",
      files: SAMPLE_FILES,
    });
    if (!created.ok) {
      setError(created.reason);
      return;
    }
    setDiff(SAMPLE_DIFF);
    installWorkspace(created.data);
  }

  async function loadSelectedFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const chosen = Array.from(files);
      if (chosen.length > 500) {
        setError("Select at most 500 files for an on-device browser workspace.");
        return;
      }
      const supported = chosen.filter((file) =>
        isTextRepositoryFile(file.webkitRelativePath || file.name),
      );
      const skipped = chosen.length - supported.length;
      const oversized = supported.find((file) => file.size > 2_000_000);
      if (oversized) {
        setError(`${oversized.name} exceeds the 2 MB on-device text-file limit.`);
        return;
      }
      if (supported.length === 0) {
        setError(
          "No supported text/source files were selected. Binary files were not decoded as code.",
        );
        return;
      }
      const selectedPaths = supported.map((file) =>
        (file.webkitRelativePath || file.name).replace(/\\/g, "/"),
      );
      const selectedRoot = selectedPaths[0].includes("/") ? selectedPaths[0].split("/")[0] : null;
      const hasSharedSelectionRoot =
        selectedRoot !== null && selectedPaths.every((path) => path.startsWith(`${selectedRoot}/`));
      const sourceFiles = await Promise.all(
        supported.map(async (file, index) => ({
          path: hasSharedSelectionRoot
            ? selectedPaths[index].slice(`${selectedRoot}/`.length)
            : selectedPaths[index],
          content: await file.text(),
        })),
      );
      const rootName = selectedRoot ?? "Selected repository";
      const created = createCodeWorkspace({ name: rootName, files: sourceFiles });
      if (!created.ok) {
        setError(created.reason);
        return;
      }
      installWorkspace(created.data);
      if (skipped > 0) {
        setTerminal((lines) => [
          ...lines,
          `intake: ${skipped} unsupported/binary file${skipped === 1 ? "" : "s"} skipped and not analysed`,
        ]);
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The selected repository could not be read.",
      );
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function runAnalysis() {
    if (!workspace) return;
    const result = analyseWorkspace(workspace);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setAnalysis(result.data);
    setAnalysisEvidence(result.evidence);
    setError(null);
    setTerminal((lines) => [...lines, `analysis: ${result.evidence}`]);
  }

  function runSearch() {
    if (!workspace) return;
    if (searchMode === "text") {
      const result = searchWorkspaceText(workspace, searchQuery);
      if (!result.ok) {
        setSearchView({ kind: "error", message: result.reason });
        return;
      }
      setSearchView({
        kind: "results",
        evidence: result.evidence,
        rows: result.data.map((hit) => ({ path: hit.path, line: hit.line, text: hit.text })),
      });
      return;
    }
    if (searchMode === "symbol") {
      const result = searchWorkspaceSymbol(workspace, searchQuery);
      if (!result.ok) {
        setSearchView({ kind: "error", message: result.reason });
        return;
      }
      setSearchView({
        kind: "results",
        evidence: result.evidence,
        rows: result.data.map((hit) => ({
          path: hit.path,
          line: hit.symbol.line,
          text: `${hit.symbol.kind} ${hit.symbol.name}`,
        })),
      });
      return;
    }
    const result = searchWorkspaceReferences(workspace, searchQuery);
    if (!result.ok) {
      setSearchView({ kind: "error", message: result.reason });
      return;
    }
    setSearchView({
      kind: "results",
      evidence: result.evidence,
      rows: [...result.data.definitions, ...result.data.references].map((hit) => ({
        path: hit.path,
        line: hit.line,
        text: `${hit.isDeclaration ? "definition" : "textual candidate"} · ${hit.text}`,
      })),
    });
  }

  async function previewPatch() {
    if (!workspace) return;
    setBusy(true);
    const result = await previewCodePatch(workspace, diff);
    setBusy(false);
    if (!result.ok) {
      setPreview(null);
      setError(result.reason);
      return;
    }
    setPreview(result.data);
    setSelectedPath(result.data.path);
    setError(null);
    setTerminal((lines) => [...lines, `preview: ${result.evidence}`]);
  }

  async function applyPatch() {
    if (!workspace) return;
    setBusy(true);
    const result = await applyCodePatch(workspace, diff);
    setBusy(false);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setWorkspace(result.data.workspace);
    setPreview(null);
    setAnalysis(null);
    setError(null);
    setTerminal((lines) => [
      ...lines,
      `patch: ${result.evidence}`,
      `checkpoint: before ${result.data.change.beforeSha256.slice(0, 12)}… · after ${result.data.change.afterSha256.slice(0, 12)}…`,
    ]);
  }

  async function undoLatest() {
    if (!workspace || !latestChange) return;
    setBusy(true);
    const result = await undoCodeChange(workspace, latestChange.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setWorkspace(result.data.workspace);
    setAnalysis(null);
    setPreview(null);
    setError(null);
    setTerminal((lines) => [...lines, `undo: ${result.evidence}`]);
  }

  async function runCommand() {
    if (!workspace) return;
    setBusy(true);
    const result = await runWorkspaceCommand(workspace, command, unavailableHost);
    setBusy(false);
    if (!result.ok) {
      setError(result.reason);
      setTerminal((lines) => [...lines, `${command}: unavailable · ${result.reason}`]);
      return;
    }
    setWorkspace(result.data.workspace);
    setTerminal((lines) => [
      ...lines,
      `$ ${command}`,
      result.data.observation.stdout,
      result.data.observation.stderr,
      `exit ${result.data.observation.exitCode} · ${result.data.receipt.evidence}`,
    ]);
  }

  function validateSandboxPlan() {
    const validated = validateGeneratedSandboxRequest({
      taskId: workspace?.id ?? "code-workspace",
      language: "javascript",
      script: generatedScript,
      inputs: [{ path: "source.txt", content: selectedFile?.content ?? "" }],
      outputs: [{ path: "result.txt", mediaType: "text/plain", maxBytes: 100_000 }],
      allowedImports: [],
      network: "disabled",
      limits: {
        wallTimeMs: 10_000,
        cpuTimeMs: 10_000,
        memoryMb: 128,
        storageBytes: 1_000_000,
        outputBytes: 200_000,
      },
    });
    setSandboxStatus(
      validated.ok
        ? "Plan admitted. Network, imports, child processes and undeclared paths remain denied. Use Execute to run it in the Node permission host."
        : (validated.reason ?? "Sandbox plan was refused."),
    );
  }

  /**
   * Actually run the plan in the Node permission host (P21).
   *
   * Validation only ever proved the request was admissible; execution needed a
   * host, and the only real one was reachable from tests alone. It runs on the
   * server because the host spawns a process — the browser has nothing to
   * spawn — and network stays denied there regardless of what is asked.
   */
  async function executeSandboxPlan() {
    setSandboxRunning(true);
    setSandboxStatus("Running in the Node permission host…");
    try {
      const res = (await runSandbox({
        data: {
          taskId: workspace?.id ?? "code-workspace",
          language: "javascript" as const,
          script: generatedScript,
          inputs: [{ path: "source.txt", content: selectedFile?.content ?? "" }],
          outputs: [{ path: "result.txt", mediaType: "text/plain", maxBytes: 100_000 }],
          allowedImports: [],
          timeoutMs: 10_000,
          memoryMb: 128,
        },
      })) as SandboxRunResponse;
      setSandboxStatus(
        res.ok
          ? `${res.result.status}: ${res.result.diffs.length} declared output(s) changed; undeclared paths were not written.`
          : `Refused: ${res.reason}`,
      );
    } catch (e) {
      setSandboxStatus(
        e instanceof Error ? `Could not run: ${e.message}` : "Could not run the sandbox.",
      );
    } finally {
      setSandboxRunning(false);
    }
  }

  async function savePatchArtifact() {
    if (!workspace || !latestChange) return;
    const stored = await saveArtifact({
      name: `Code patch · ${latestChange.path}`,
      kind: "patch",
      content: latestChange.patchText,
      provenance: {
        producedBy: `ocade.code:${workspace.id}`,
        verified: latestChange.undoVerified,
        evidence: latestChange.receipt.evidence,
      },
      privacyClass: "on_device",
      compatibleApps: ["Git", "text editors"],
    });
    if (!stored.ok) {
      setError(stored.reason);
      return;
    }
    toast.success("Patch saved to on-device Artifacts.");
    setTerminal((lines) => [
      ...lines,
      `artifact: ${stored.data.id} · sha256 ${stored.data.sha256.slice(0, 12)}…`,
    ]);
  }

  function exportReceipt() {
    if (!workspace) return;
    download(
      `${workspace.name.replace(/[^\w-]+/g, "-") || "ocade-code"}-receipt.json`,
      JSON.stringify(
        {
          workspaceId: workspace.id,
          name: workspace.name,
          revision: workspace.revision,
          files: workspace.files.map((file) => file.path),
          changes: workspace.changes,
          history: workspace.history,
          exportedAt: new Date().toISOString(),
          boundary:
            "This receipt records the on-device session workspace. Host files were not written by the browser.",
        },
        null,
        2,
      ),
      "application/json",
    );
  }

  return (
    <div className="space-y-4">
      <GlassPanel className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <FolderOpen className="h-4 w-4" aria-hidden /> Repository
            </h2>
            <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
              Load user-selected text files into session memory. The browser does not receive a
              hidden filesystem or shell, and it does not write the selected directory.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={(node) => {
                fileInputRef.current = node;
                if (node) node.setAttribute("webkitdirectory", "");
              }}
              type="file"
              tabIndex={-1}
              multiple
              className="sr-only"
              onChange={(event) => void loadSelectedFiles(event.target.files)}
              aria-label="Select repository folder"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Select folder
            </Button>
            <Button size="sm" variant="outline" onClick={loadSample} disabled={busy}>
              <FileCode2 className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Load temporary sample
            </Button>
          </div>
        </div>

        {workspace ? (
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <span className="rounded border border-border/60 px-2 py-1">{workspace.name}</span>
            <span className="rounded border border-border/60 px-2 py-1">
              {workspace.files.length} files
            </span>
            <span className="rounded border border-border/60 px-2 py-1">
              revision {workspace.revision}
            </span>
            <span className="rounded border border-border/60 px-2 py-1">session memory only</span>
          </div>
        ) : (
          <p className="mt-3 rounded border border-dashed border-border/70 p-3 text-xs text-muted-foreground">
            No repository loaded. Select a folder or use the bounded temporary sample.
          </p>
        )}
      </GlassPanel>

      {workspace ? (
        <>
          <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_300px]">
            <GlassPanel className="min-h-[420px] p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                File tree
              </h3>
              <div className="max-h-[520px] space-y-0.5 overflow-auto">
                {workspace.files.map((file) => (
                  <button
                    aria-current={selectedPath === file.path ? "true" : undefined}
                    key={file.path}
                    onClick={() => setSelectedPath(file.path)}
                    className={`block w-full truncate rounded px-2 py-1.5 text-left font-mono text-[11px] ${
                      selectedPath === file.path
                        ? "bg-primary/15 text-foreground"
                        : "text-muted-foreground hover:bg-accent"
                    }`}
                    title={file.path}
                  >
                    {file.path}
                  </button>
                ))}
              </div>
            </GlassPanel>

            <GlassPanel className="min-w-0 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="truncate font-mono text-xs font-semibold">
                  {selectedFile?.path ?? "Select a file"}
                </h3>
                <span className="text-[10px] text-muted-foreground">read-only preview</span>
              </div>
              <pre className="mt-2 max-h-[500px] min-h-[360px] overflow-auto rounded border border-border/60 bg-background/50 p-3 font-mono text-[11px] leading-5 text-foreground">
                {selectedFile?.content ?? ""}
              </pre>
            </GlassPanel>

            <GlassPanel className="p-3">
              <h3 className="text-xs font-semibold">Applicable instructions</h3>
              {instructions.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {instructions.map((item) => (
                    <div key={item.path} className="rounded border border-border/60 p-2">
                      <p className="font-mono text-[10px] font-semibold text-foreground">
                        {item.path}
                      </p>
                      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-[10px] leading-4 text-muted-foreground">
                        {item.content}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  No applicable AGENTS.md file was supplied for this path.
                </p>
              )}
            </GlassPanel>
          </div>

          <GlassPanel className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="h-4 w-4" aria-hidden /> Secure generated-code sandbox
                </h3>
                <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
                  Generated JavaScript receives only readText, writeText, log and bounded sleep.
                  Filesystem scope, subprocesses, dynamic code and network access are denied. The
                  browser validates the plan but never pretends it launched the isolated host.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={validateSandboxPlan}>
                Validate sandbox plan
              </Button>
              <Button size="sm" onClick={() => void executeSandboxPlan()} disabled={sandboxRunning}>
                {sandboxRunning ? "Running…" : "Execute in sandbox"}
              </Button>
            </div>
            <Textarea
              value={generatedScript}
              onChange={(event) => {
                setGeneratedScript(event.target.value);
                setSandboxStatus(null);
              }}
              aria-label="Generated sandbox script"
              className="mt-3 min-h-32 font-mono text-[11px]"
              spellCheck={false}
            />
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
              {["network denied", "imports denied", "child processes denied", "10 s", "128 MB"].map(
                (label) => (
                  <span key={label} className="rounded border border-border/60 px-2 py-1">
                    {label}
                  </span>
                ),
              )}
            </div>
            {sandboxStatus ? (
              <p role="status" className="mt-2 text-xs text-muted-foreground">
                {sandboxStatus}
              </p>
            ) : null}
          </GlassPanel>

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassPanel className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <GitBranch className="h-4 w-4" aria-hidden /> Map and diagnostics
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Imports, exports, cycles, broken relative imports, and conservative unreferenced
                    findings.
                  </p>
                </div>
                <Button size="sm" onClick={runAnalysis}>
                  Analyse repository
                </Button>
              </div>
              {analysis ? (
                <div role="status" className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  {[
                    ["Files", analysis.diagnostics.files],
                    ["Internal edges", analysis.diagnostics.edges],
                    ["Symbols", analysis.symbols.length],
                    ["Broken imports", analysis.diagnostics.brokenImports],
                    ["Cycles", analysis.diagnostics.cycles],
                    ["Unparsed", analysis.map.unparsed.length],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded border border-border/60 p-2">
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <p className="text-base font-semibold">{value}</p>
                    </div>
                  ))}
                  <p className="col-span-full text-[11px] text-muted-foreground">
                    {analysisEvidence}
                  </p>
                </div>
              ) : null}
            </GlassPanel>

            <GlassPanel className="p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Search className="h-4 w-4" aria-hidden /> Search
              </h3>
              <div className="mt-3 flex gap-2">
                <select
                  value={searchMode}
                  onChange={(event) =>
                    setSearchMode(event.target.value as "text" | "symbol" | "references")
                  }
                  aria-label="Search mode"
                  className="rounded border border-border bg-background px-2 text-xs"
                >
                  <option value="text">Text</option>
                  <option value="symbol">Exact symbol</option>
                  <option value="references">Textual references</option>
                </select>
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") runSearch();
                  }}
                  placeholder={searchMode === "text" ? "Search repository text" : "Symbol name"}
                  aria-label="Repository search"
                  className="h-9"
                />
                <Button size="sm" onClick={runSearch}>
                  Search
                </Button>
              </div>
              {searchView.kind === "error" ? (
                <p role="status" className="mt-3 text-xs text-destructive">
                  {searchView.message}
                </p>
              ) : searchView.kind === "results" ? (
                <div role="status" className="mt-3">
                  <p className="text-[11px] text-muted-foreground">{searchView.evidence}</p>
                  <div className="mt-2 max-h-52 space-y-1 overflow-auto">
                    {searchView.rows.map((row, index) => (
                      <button
                        key={`${row.path}:${row.line}:${index}`}
                        onClick={() => setSelectedPath(row.path)}
                        className="block w-full rounded border border-border/60 p-2 text-left hover:bg-accent"
                      >
                        <span className="font-mono text-[10px] text-primary">
                          {row.path}:{row.line}
                        </span>
                        <span className="ml-2 text-[11px] text-muted-foreground">{row.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </GlassPanel>
          </div>

          <GlassPanel className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="h-4 w-4" aria-hidden /> Exact patch and checkpoint
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Preview and apply only when every hunk matches exactly. Before/after SHA-256 and
                  an exercised inverse are recorded before the change is accepted.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void previewPatch()}
                  disabled={busy}
                >
                  Preview
                </Button>
                <Button size="sm" onClick={() => void applyPatch()} disabled={busy}>
                  Apply in session
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void undoLatest()}
                  disabled={busy || !latestChange}
                  title={
                    latestChange
                      ? "Restore the latest verified checkpoint"
                      : "No applied change to undo"
                  }
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Undo latest
                </Button>
              </div>
            </div>
            <Textarea
              value={diff}
              onChange={(event) => setDiff(event.target.value)}
              aria-label="Unified patch"
              className="mt-3 min-h-52 font-mono text-[11px]"
              spellCheck={false}
            />
            {preview ? (
              <div role="status" className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="min-w-0 rounded border border-border/60 p-2">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                    Before
                  </p>
                  <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[10px]">
                    {preview.before}
                  </pre>
                </div>
                <div className="min-w-0 rounded border border-primary/30 bg-primary/5 p-2">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">After</p>
                  <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[10px]">
                    {preview.after}
                  </pre>
                </div>
              </div>
            ) : null}
            {latestChange ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                <CheckCircle2
                  className="h-3.5 w-3.5 text-[color:var(--state-success)]"
                  aria-hidden
                />
                <span>{latestChange.receipt.evidence}</span>
                <span>before {latestChange.beforeSha256.slice(0, 12)}…</span>
                <span>after {latestChange.afterSha256.slice(0, 12)}…</span>
                <Button size="sm" variant="ghost" onClick={() => void savePatchArtifact()}>
                  <Save className="mr-1 h-3 w-3" aria-hidden /> Save artifact
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    download(
                      `${latestChange.path.replace(/[^\w.-]+/g, "-")}.diff`,
                      latestChange.patchText,
                    )
                  }
                >
                  <Download className="mr-1 h-3 w-3" aria-hidden /> Export patch
                </Button>
              </div>
            ) : null}
          </GlassPanel>

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassPanel className="p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Terminal className="h-4 w-4" aria-hidden /> Tests, build, and runtime
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Commands require a host that returns the observed exit code and output. The browser
                has no shell; dispatch is refused until a verified companion host is connected.
              </p>
              <div className="mt-3 flex gap-2">
                <select
                  value={command}
                  onChange={(event) => setCommand(event.target.value as CodeCommand)}
                  aria-label="Code command"
                  className="rounded border border-border bg-background px-2 text-xs"
                >
                  <option value="test">Focused/full tests</option>
                  <option value="typecheck">Typecheck</option>
                  <option value="lint">Lint</option>
                  <option value="build">Build</option>
                  <option value="runtime">Runtime check</option>
                </select>
                <Button size="sm" onClick={() => void runCommand()} disabled={busy}>
                  <Play className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Request run
                </Button>
              </div>
              <pre
                aria-label="Terminal output"
                className="mt-3 min-h-44 max-h-72 overflow-auto rounded border border-border/60 bg-black/80 p-3 font-mono text-[10px] leading-5 text-foreground"
              >
                {terminal.length > 0
                  ? terminal.filter((line) => line !== "").join("\n")
                  : "No command observation yet."}
              </pre>
            </GlassPanel>

            <GlassPanel className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Plan, history, and recovery</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Every accepted state transition is visible; command acknowledgements are not
                    promoted to verified execution.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={exportReceipt}>
                  <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Export receipt
                </Button>
              </div>
              <ol className="mt-3 space-y-1 text-[11px]">
                {[
                  ["Repository and rules inspected", true],
                  ["Map and diagnostics generated", Boolean(analysis)],
                  ["Patch previewed exactly", Boolean(preview) || workspace.changes.length > 0],
                  ["Before/after checkpoint recorded", workspace.changes.length > 0],
                  ["Undo exercised", workspace.changes.some((change) => change.undoVerified)],
                  [
                    "Tests/build observed",
                    workspace.history.some(
                      (entry) => entry.kind === "command" && entry.status === "verified",
                    ),
                  ],
                  ["Diff and receipt export available", true],
                ].map(([label, done]) => (
                  <li key={String(label)} className="flex items-center gap-2">
                    {done ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--state-success)]" />
                    ) : (
                      <span className="h-3.5 w-3.5 rounded-full border border-border" />
                    )}
                    <span className={done ? "text-foreground" : "text-muted-foreground"}>
                      {label}
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mt-3 max-h-52 space-y-1 overflow-auto border-t border-border/60 pt-3">
                {workspace.history
                  .slice()
                  .reverse()
                  .map((entry) => (
                    <div key={entry.id} className="rounded border border-border/60 p-2 text-[10px]">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{entry.label}</span>
                        <span className="ml-auto uppercase text-muted-foreground">
                          {entry.status}
                        </span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{entry.evidence}</p>
                    </div>
                  ))}
              </div>
            </GlassPanel>
          </div>
        </>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}
