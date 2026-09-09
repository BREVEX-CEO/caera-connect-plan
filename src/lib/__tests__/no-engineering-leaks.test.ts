import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Nothing a normal user reads may name the machinery.
 *
 * WHAT "THE MACHINERY" MEANS HERE. The foundation model and its vendor, the
 * weight filename, the graphics API the runtime chose, the quantisation format.
 * Every one of those is real and every one of them is someone else's
 * vocabulary. A person deciding whether to trust OCADE with their desktop does
 * not benefit from learning that q4_k_m is a quantisation scheme; they benefit
 * from "Local Intelligence — runs on this device".
 *
 * The facts are not hidden from anyone entitled to them. Advanced settings,
 * diagnostics, verification receipts and the licence notices still carry the
 * exact identifiers, because a provenance claim that will not name what it is
 * about is not a provenance claim. This asserts the boundary between two
 * audiences, not the absence of the facts.
 *
 * WHY IT READS JSX TEXT AND A FIXED SET OF PROPS RATHER THAN EVERY STRING.
 * `"webgpu"` passed to `loadBenchmark()` is an adapter key, not a sentence, and
 * a comment explaining why the WASM fallback exists is engineering writing for
 * engineers. Forbidding either would push real reasoning out of the code, which
 * costs more than it saves. So this looks at what is rendered: text between
 * tags, and the props whose values reach the screen.
 */

const USER_FACING = ["src/routes", "src/components"];

/** Where the exact identifiers are legitimate, and required. */
const TECHNICAL = [
  "settings.$section.tsx",
  "EngineImportPanel.tsx",
  "LocalEngineSettingsPanel.tsx",
  "OfflineStoragePanel.tsx",
  "LocalModelLifecyclePanel.tsx",
];

/** Props whose values are rendered to a person. */
const RENDERED_PROPS =
  /\b(title|label|description|summary|eyebrow|placeholder|aria-label|detail|hint|heading|caption|message)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g;

function sources(): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        if (entry !== "__tests__") walk(path);
        continue;
      }
      if (!/\.tsx$/.test(entry)) continue;
      if (TECHNICAL.some((allowed) => entry === allowed)) continue;
      out.push({ path, text: readFileSync(path, "utf8") });
    }
  };
  for (const root of USER_FACING) walk(root);
  return out;
}

/** Text that reaches the screen: JSX text nodes and rendered prop values. */
function renderedText(source: string): string {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, " ");
  const code = withoutBlockComments.replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1 ");
  const parts: string[] = [];
  for (const match of code.match(/>[^<>{}]{4,}</g) ?? []) parts.push(match.slice(1, -1));
  for (const match of code.matchAll(RENDERED_PROPS)) {
    parts.push(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return parts.join("\n");
}

const RULES: { name: string; pattern: RegExp }[] = [
  {
    name: "a foundation model or its vendor",
    pattern:
      /\b(qwen|llama|mistral|gemma|phi-?[0-9]|smollm|deepseek|openai|gpt-?[0-9]|gemini|anthropic|ollama|webllm|wllama)\b/i,
  },
  { name: "a graphics or runtime API", pattern: /\b(webgpu|web ?assembly|wasm)\b/i },
  {
    name: "a weight file or quantisation format",
    pattern: /\.(gguf|safetensors|onnx)\b|\bq[0-9]_[a-z0-9_]+\b/i,
  },
  { name: "a raw digest", pattern: /\b[a-f0-9]{32,}\b/i },
];

describe("user-facing text never names the machinery", () => {
  it.each(RULES)("names no $name", ({ pattern }) => {
    const offenders: string[] = [];
    for (const { path, text } of sources()) {
      for (const line of renderedText(text).split("\n")) {
        const hit = line.match(pattern);
        if (hit) offenders.push(`${path}: "${hit[0]}" in — ${line.trim().slice(0, 80)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("the facts stay available where they belong", () => {
  it("keeps the file identity and its fingerprint in Advanced", () => {
    /*
     * The other half of the boundary. Asserted so that a future tidy-up of the
     * leaks above cannot quietly take the receipts with them: a person who
     * wants to verify what is running on their machine must still be able to.
     */
    const advanced = readFileSync("src/components/settings/EngineImportPanel.tsx", "utf8");
    expect(advanced).toMatch(/SHA-256/);
    expect(advanced).toMatch(/entry\.sha256/);
  });
});

describe("the choice a person is offered", () => {
  /*
   * The mode list left the Chat route in the Phase 1 split. It is read from the
   * module that declares it, so this keeps asserting the words a person is
   * actually offered.
   */
  const CHAT = readFileSync("src/components/ocade/chat/conversation-model.ts", "utf8");
  const ROUTE = readFileSync("src/routes/_authenticated/ocade.index.tsx", "utf8");

  it("is Fast, Thinking and Local Intelligence", () => {
    for (const label of ["Fast", "Thinking", "Local Intelligence"]) {
      expect(CHAT).toContain(`label: "${label}"`);
    }
  });

  it("no longer offers two names for the same thing", () => {
    /*
     * The row said "OCADE Automatic / OCADE On this device". Both run on the
     * device, so it was two ways of saying one thing — and neither answered the
     * question somebody actually has, which is whether they want the answer
     * sooner or better.
     */
    expect(ROUTE).not.toContain('t === "auto" ? "Automatic" : "On this device"');
  });

  it("explains each mode without naming a runtime", () => {
    const hints = [...CHAT.matchAll(/hint: "([^"]+)"/g)].map((match) => match[1]);
    expect(hints.length).toBeGreaterThanOrEqual(3);
    for (const hint of hints) {
      expect(hint).not.toMatch(/webgpu|wasm|model|engine|runtime|adapter/i);
    }
  });
});
