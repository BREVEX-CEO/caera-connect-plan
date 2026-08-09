/**
 * Stage 2 of tool routing: the catalogue, grouped by domain.
 *
 * WHAT THE MODEL IS AND IS NOT GIVEN
 * ----------------------------------
 * Given: a small set of named, typed, purpose-shaped actions with plain-English
 * descriptions — "focus a window", "read the visible text of a window", "find
 * a file under an approved folder".
 *
 * Not given, ever: a shell, a PowerShell string, a filesystem path it chose
 * itself, raw pointer coordinates as a first resort, a CDP socket, ADB, an
 * administrator token, or a credential. Those are not omissions to be filled in
 * later. Every one of them is a capability whose safety depends on a human
 * having thought about the specific case, and a tool description is not a place
 * where thinking happens.
 *
 * Each entry names the ADAPTER that executes it. The model emits a name and
 * arguments; the adapter validates those arguments against its own rules and
 * then does the work. A tool call is a request, never an instruction.
 *
 * WHY SCHEMAS LIVE NEXT TO THEIR DOMAIN
 * -------------------------------------
 * So `schemasFor(["files"])` is the whole of the file domain and cannot
 * accidentally include a browser tool. Grouping by domain in one object is what
 * makes stage-2 loading a lookup rather than a filter someone has to maintain.
 */

import type { Domain } from "./domains";
import type { ToolOutcome } from "./outcomes";

/** JSON-schema subset the local runtimes accept for function parameters. */
export interface ToolParameterSchema {
  type: "object";
  properties: Record<string, { type: string; description: string; enum?: string[] }>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  domain: Domain;
  description: string;
  parameters: ToolParameterSchema;
  /**
   * True when running this changes something on the machine. Read-only tools
   * skip the permission prompt entirely, which is what keeps observation cheap
   * enough to do before and after every action.
   */
  mutating: boolean;
  /**
   * Risk band, used by the permission layer. `high` always requires explicit
   * confirmation regardless of the user's autonomy setting.
   */
  risk: "read" | "low" | "medium" | "high";
}

/** What an adapter must satisfy to back a tool. */
export type ToolAdapter = (
  args: Record<string, unknown>,
  signal?: AbortSignal,
) => Promise<ToolOutcome>;

const object = (
  properties: ToolParameterSchema["properties"],
  required: string[] = [],
): ToolParameterSchema => ({ type: "object", properties, required });

const NO_ARGS = object({});

/* ------------------------------------------------------------ os_app -- */

const OS_APP: ToolDefinition[] = [
  {
    name: "screen_observe",
    domain: "os_app",
    description:
      "Look at the computer right now. Returns the active window, the list of open windows, the accessibility structure of the focused window, and its visible text. Use this before acting, and again after acting, to see what actually happened.",
    parameters: object({
      windowTitle: {
        type: "string",
        description:
          "Optional. Part of the title of the window to look at. Defaults to the focused window.",
      },
      includeText: {
        type: "string",
        description:
          "Set to 'yes' to read visible text with OCR when the window exposes little structure.",
        enum: ["yes", "no"],
      },
    }),
    mutating: false,
    risk: "read",
  },
  {
    name: "window_list",
    domain: "os_app",
    description: "List the windows currently open, with their application names.",
    parameters: NO_ARGS,
    mutating: false,
    risk: "read",
  },
  {
    name: "window_focus",
    domain: "os_app",
    description:
      "Bring a window to the front so it can be worked with. Identify it by part of its title.",
    parameters: object(
      { windowTitle: { type: "string", description: "Part of the window's title." } },
      ["windowTitle"],
    ),
    mutating: true,
    risk: "low",
  },
  {
    name: "app_open",
    domain: "os_app",
    description:
      "Open an installed application by name. Only applications the user has approved can be started.",
    parameters: object({ name: { type: "string", description: "The application's name." } }, [
      "name",
    ]),
    mutating: true,
    risk: "medium",
  },
  {
    name: "app_list_installed",
    domain: "os_app",
    description:
      "List the applications installed on this computer, with publisher and version. Use this to find out what is available before deciding how to do something.",
    parameters: NO_ARGS,
    mutating: false,
    risk: "read",
  },
  {
    name: "control_find",
    domain: "os_app",
    description:
      "Find a button, field or other control in a window by what it is called. Returns matches with their state. Does not press anything.",
    parameters: object(
      {
        name: { type: "string", description: "The visible label, e.g. 'Continue'." },
        role: { type: "string", description: "Optional control kind, e.g. 'Button', 'Edit'." },
        windowTitle: { type: "string", description: "Optional. Defaults to the focused window." },
      },
      ["name"],
    ),
    mutating: false,
    risk: "read",
  },
  {
    name: "control_activate",
    domain: "os_app",
    description:
      "Press a button or activate a control by its label. OCADE checks afterwards that the window actually changed, and reports it if it did not.",
    parameters: object(
      {
        name: { type: "string", description: "The visible label of the control to press." },
        role: { type: "string", description: "Optional control kind, e.g. 'Button'." },
        windowTitle: { type: "string", description: "Optional. Defaults to the focused window." },
      },
      ["name"],
    ),
    mutating: true,
    risk: "medium",
  },
  {
    name: "control_set_text",
    domain: "os_app",
    description:
      "Type text into a named field in an application. Refuses anything that looks like a password, code or payment value.",
    parameters: object(
      {
        name: { type: "string", description: "The field's label." },
        value: { type: "string", description: "The text to put in it." },
        windowTitle: { type: "string", description: "Optional. Defaults to the focused window." },
      },
      ["name", "value"],
    ),
    mutating: true,
    risk: "medium",
  },
  {
    name: "system_status",
    domain: "os_app",
    description:
      "Read how the computer is doing: processor load, memory, disk space, battery, and the processes using the most resources. Read-only.",
    parameters: NO_ARGS,
    mutating: false,
    risk: "read",
  },
];

/* ------------------------------------------------------------- files -- */

const FILES: ToolDefinition[] = [
  {
    name: "file_search",
    domain: "files",
    description:
      "Search for files by name inside a folder the user has approved. Returns paths and sizes.",
    parameters: object(
      {
        folder: { type: "string", description: "The approved folder to search in." },
        match: { type: "string", description: "Part of the file name to look for." },
      },
      ["folder", "match"],
    ),
    mutating: false,
    risk: "read",
  },
  {
    name: "file_read",
    domain: "files",
    description: "Read the text content of a file inside an approved folder.",
    parameters: object(
      {
        folder: { type: "string", description: "The approved folder the file is in." },
        path: { type: "string", description: "The file to read." },
      },
      ["folder", "path"],
    ),
    mutating: false,
    risk: "read",
  },
  {
    name: "file_copy",
    domain: "files",
    description:
      "Copy a file inside an approved folder. The copy is verified by comparing content hashes, not by assuming success.",
    parameters: object(
      {
        folder: { type: "string", description: "The approved folder." },
        from: { type: "string", description: "The file to copy." },
        to: { type: "string", description: "Where to put the copy." },
      },
      ["folder", "from", "to"],
    ),
    mutating: true,
    risk: "low",
  },
  {
    name: "file_move",
    domain: "files",
    description: "Move or rename a file inside an approved folder.",
    parameters: object(
      {
        folder: { type: "string", description: "The approved folder." },
        from: { type: "string", description: "The file to move." },
        to: { type: "string", description: "Its new location or name." },
      },
      ["folder", "from", "to"],
    ),
    mutating: true,
    risk: "medium",
  },
  {
    name: "file_trash",
    domain: "files",
    description:
      "Move a file to the trash. This is always reversible — OCADE cannot permanently delete a file.",
    parameters: object(
      {
        folder: { type: "string", description: "The approved folder." },
        path: { type: "string", description: "The file to move to the trash." },
      },
      ["folder", "path"],
    ),
    mutating: true,
    risk: "high",
  },
  {
    name: "file_restore",
    domain: "files",
    description: "Put a file back from the trash, refusing unless its content still matches.",
    parameters: object(
      {
        folder: { type: "string", description: "The approved folder." },
        id: { type: "string", description: "The trash record's id." },
      },
      ["folder", "id"],
    ),
    mutating: true,
    risk: "low",
  },
];

/* --------------------------------------------------------------- web -- */

const WEB: ToolDefinition[] = [
  {
    name: "browser_open",
    domain: "web",
    description: "Open or focus a managed browser window. Do this before other browser actions.",
    parameters: object({
      browser: { type: "string", description: "Which browser to use.", enum: ["chrome", "edge"] },
    }),
    mutating: true,
    risk: "low",
  },
  {
    name: "browser_navigate",
    domain: "web",
    description: "Go to a web address in the managed browser.",
    parameters: object({ url: { type: "string", description: "The full https address." } }, [
      "url",
    ]),
    mutating: true,
    risk: "low",
  },
  {
    name: "browser_read",
    domain: "web",
    description:
      "Read the current page: its title, address, visible text, headings, links and form fields.",
    parameters: NO_ARGS,
    mutating: false,
    risk: "read",
  },
  {
    name: "browser_click",
    domain: "web",
    description:
      "Click something on the page by its visible text or role. OCADE verifies afterwards that the page actually changed.",
    parameters: object(
      {
        text: { type: "string", description: "The visible text of the thing to click." },
        role: { type: "string", description: "Optional role, e.g. 'link', 'button'." },
      },
      ["text"],
    ),
    mutating: true,
    risk: "medium",
  },
  {
    name: "browser_type",
    domain: "web",
    description:
      "Type into a field on the page. Refuses password and payment fields, which stay under the user's control.",
    parameters: object(
      {
        selector: { type: "string", description: "The field, by its label, placeholder or role." },
        value: { type: "string", description: "The text to enter." },
      },
      ["selector", "value"],
    ),
    mutating: true,
    risk: "medium",
  },
  {
    name: "browser_tabs",
    domain: "web",
    description: "List the open tabs in the managed browser with their titles and addresses.",
    parameters: NO_ARGS,
    mutating: false,
    risk: "read",
  },
  {
    name: "web_search",
    domain: "web",
    description:
      "Search the web for current information and return results with their sources, so answers can be cited.",
    parameters: object({ query: { type: "string", description: "What to search for." } }, [
      "query",
    ]),
    mutating: false,
    risk: "read",
  },
];

const REGISTRY: Record<Domain, ToolDefinition[]> = {
  os_app: OS_APP,
  files: FILES,
  web: WEB,
  // Declared so the shape is total. Populated as each layer is connected; an
  // empty domain loads no schemas, which is honest — better than advertising a
  // tool whose adapter would refuse.
  content: [],
  connectors: [],
  cross_device: [],
  conversation: [],
};

export function toolsFor(domains: readonly Domain[]): ToolDefinition[] {
  const seen = new Set<string>();
  const out: ToolDefinition[] = [];
  for (const domain of domains) {
    for (const tool of REGISTRY[domain] ?? []) {
      if (seen.has(tool.name)) continue;
      seen.add(tool.name);
      out.push(tool);
    }
  }
  return out;
}

/** The wire format both Ollama and OpenAI-compatible runtimes accept. */
export interface WireTool {
  type: "function";
  function: { name: string; description: string; parameters: ToolParameterSchema };
}

export function schemasFor(domains: readonly Domain[]): WireTool[] {
  return toolsFor(domains).map((tool) => ({
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }));
}

export function findTool(name: string): ToolDefinition | null {
  for (const domain of Object.keys(REGISTRY) as Domain[]) {
    const hit = REGISTRY[domain].find((tool) => tool.name === name);
    if (hit) return hit;
  }
  return null;
}

/** Every tool name in the catalogue. Used by tests to assert wiring. */
export function allToolNames(): string[] {
  return (Object.keys(REGISTRY) as Domain[]).flatMap((d) => REGISTRY[d].map((t) => t.name));
}
