/**
 * THE TEST THAT KEEPS THE PROMPT ON THE DEVICE.
 *
 * OCADE's constitution says public-cloud inference is not an allowed fallback.
 * Before this test, the product said that and did the opposite: the signed-in
 * Chat page posted to /api/ocade/chat, which streamed to the Lovable AI
 * Gateway and on to google/gemini-3.5-flash, and the "Improve prompt" button
 * sent the composer's contents to the same place with no gate at all.
 *
 * Deleting that code fixes it once. This test is what stops it coming back —
 * as a "temporary fallback", a "demo provider", a "summarizer", or a title
 * generator that seemed too small to matter. It reads the shipped source
 * rather than mocking anything, because the claim is about what is in the
 * bundle, and a mock cannot tell you that.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { resolveEngine, type EngineContext } from "../engine/resolve";

/** Every shipped source file. Tests are excluded; they may name the hosts. */
function shippedFiles(root = "src"): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === "__tests__") continue;
        walk(full);
        continue;
      }
      if (![".ts", ".tsx"].includes(extname(entry))) continue;
      if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) continue;
      out.push(full);
    }
  };
  walk(root);
  return out;
}

const FILES = shippedFiles();
const SOURCES = new Map(FILES.map((f) => [f, readFileSync(f, "utf8")]));

/**
 * Hosts that perform inference. Deliberately NOT a list of every third party:
 * Supabase, model repositories and search engines are data services and are
 * meant to be reachable.
 */
const INFERENCE_HOSTS = [
  "api.openai.com",
  "ai.gateway.lovable.dev",
  "generativelanguage.googleapis.com",
  "api.anthropic.com",
  "openrouter.ai",
  "api.groq.com",
  "api.mistral.ai",
  "api.cohere.ai",
  "api.together.xyz",
  "api.deepseek.com",
];

describe("no shipped code can send a prompt to a public AI provider", () => {
  it("names no inference host anywhere in shipped source", () => {
    const offenders: string[] = [];
    for (const [file, text] of SOURCES) {
      for (const host of INFERENCE_HOSTS) {
        if (text.includes(host)) offenders.push(`${file} -> ${host}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("does not import the cloud-provider AI SDK", () => {
    const offenders: string[] = [];
    for (const [file, text] of SOURCES) {
      // `from "ai"` / `import("ai")` — the Vercel AI SDK, whose entire purpose
      // is talking to hosted model providers.
      if (/from\s+["']ai["']|import\(\s*["']ai["']\s*\)/.test(text)) offenders.push(file);
      if (/\b(streamText|generateText)\s*\(/.test(text)) offenders.push(`${file} (call)`);
    }
    expect(offenders).toEqual([]);
  });

  it("has no chat API route left to post a prompt to", () => {
    expect(FILES).not.toContain(join("src", "routes", "api", "ocade.chat.ts"));
    const offenders = [...SOURCES].filter(([, t]) => t.includes("/api/ocade/chat"));
    expect(offenders.map(([f]) => f)).toEqual([]);
  });

  it("keeps no gateway module", () => {
    const offenders = [...SOURCES].filter(([, t]) => t.includes("ai-gateway.server"));
    expect(offenders.map(([f]) => f)).toEqual([]);
  });

  it("leaves ordinary data services reachable", () => {
    // The point is local INFERENCE, not an offline product. If this ever fails
    // the fix is to the test, not to the product: Supabase and model
    // downloads are supposed to work.
    const all = [...SOURCES.values()].join("\n");
    expect(all).toMatch(/supabase/i);
    expect(all).toMatch(/huggingface|\.gguf|model-download/i);
  });

  it("does not advertise a remote inference path in shipped copy", () => {
    const forbiddenClaims = [
      /cloud-assisted AI/i,
      /cloud requests? every/i,
      /larger cloud allowance/i,
      /largest included cloud allowance/i,
      /OCADE Cloud\s*[—-]/i,
    ];
    const offenders: string[] = [];
    for (const [file, text] of SOURCES) {
      const withoutComments = text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
      for (const pattern of forbiddenClaims) {
        if (pattern.test(withoutComments)) offenders.push(`${file} -> ${pattern.source}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("the engine resolver cannot choose a remote engine", () => {
  const base: EngineContext = {
    preference: "auto",
    deviceMode: "pc_web",
    localAvailable: false,
    localLabel: null,
    localVision: false,
    visionRequired: false,
    online: true,
  };

  it("refuses instead of escalating when no local engine is ready", () => {
    const d = resolveEngine(base);
    expect(d.ok).toBe(false);
    expect(d.target).toBeNull();
    expect(d.needsCloudApproval).toBe(false);
    expect(d.consumesAllowance).toBe(false);
  });

  it("never returns a non-local target, under any combination of inputs", () => {
    for (const preference of ["auto", "local_only"] as const) {
      for (const localAvailable of [true, false]) {
        for (const visionRequired of [true, false]) {
          for (const localVision of [true, false]) {
            for (const online of [true, false]) {
              const d = resolveEngine({
                ...base,
                preference,
                localAvailable,
                localLabel: localAvailable ? "OCADE Local" : null,
                localVision,
                visionRequired,
                online,
              });
              if (d.target) expect(d.target.kind).toBe("local");
              expect(d.consumesAllowance).toBe(false);
            }
          }
        }
      }
    }
  });

  it("tells a first-time user the engine is preparing, not that it is broken", () => {
    const d = resolveEngine({ ...base, online: true });
    expect(d.code).toBe("local_engine_preparing");
    expect(d.reason).toContain("no setup needed");
  });

  it("distinguishes offline-with-no-engine from preparing", () => {
    const d = resolveEngine({ ...base, online: false });
    expect(d.code).toBe("offline_and_no_local_engine");
  });
});
