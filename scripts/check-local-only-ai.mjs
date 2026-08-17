import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN = ["src", ".env.example"];
const SKIP = new Set(["node_modules", "dist", ".git", "coverage"]);

// These are concrete remote-AI execution markers, not generic words such as
// "cloud" that may legitimately describe sync/storage documentation.
const FORBIDDEN = [
  [/OPENAI_API_KEY/g, "OpenAI chat API key"],
  [/LOVABLE_API_KEY/g, "Lovable AI gateway API key"],
  [/https:\/\/api\.openai\.com/gi, "OpenAI public AI endpoint"],
  [/https:\/\/ai\.gateway\.lovable\.dev/gi, "Lovable public AI gateway"],
  [/google\/gemini-[\w.-]+/gi, "Gemini cloud model id"],
  [/openai\/gpt-[\w.-]+/gi, "OpenAI cloud model id"],
  [/createOpenAIDirectGateway/g, "OpenAI cloud gateway constructor"],
  [/createLovableGateway/g, "Lovable cloud gateway constructor"],
  [/from\s+["']@ai-sdk\/openai-compatible["']/g, "OpenAI-compatible cloud SDK import"],
  [/\bOCADE Cloud\b/g, "OCADE Cloud product path"],
];

const files = [];
function walk(path) {
  const stat = statSync(path);
  if (stat.isFile()) {
    files.push(path);
    return;
  }
  for (const name of readdirSync(path)) {
    if (SKIP.has(name)) continue;
    walk(join(path, name));
  }
}
for (const entry of SCAN) walk(join(ROOT, entry));

const errors = [];
for (const file of files) {
  if (/\.(png|jpe?g|webp|ico|woff2?|wasm)$/i.test(file)) continue;
  const text = readFileSync(file, "utf8");
  for (const [pattern, label] of FORBIDDEN) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) errors.push(`${relative(ROOT, file)}: ${label}`);
  }
}

const required = [
  ["src/lib/engine/resolve.ts", /no cloud-model fallback|no cloud fallback|cloud.*removed/i],
  ["src/routes/api/ocade.chat.ts", /status:\s*410/],
  ["src/lib/brain/adapters/shared-browser.ts", /navigator\.locks/],
  ["src/lib/brain/adapters/shared-browser.ts", /BroadcastChannel/],
  ["src/lib/brain/adapters/browser-webgpu.ts", /cacheBackend:\s*["']indexeddb["']/],
  ["src/lib/local/model-lifecycle.ts", /DEFAULT_PULL_ATTEMPTS\s*=\s*5/],
  ["public/sw.js", /OCADE_RETRY_OFFLINE_CACHE/],
];
for (const [path, pattern] of required) {
  const text = readFileSync(join(ROOT, path), "utf8");
  if (!pattern.test(text)) errors.push(`${path}: missing required local-only control ${pattern}`);
}

if (errors.length) {
  console.error("OCADE local-only AI gate FAILED");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("OCADE local-only AI gate OK");
console.log("- no Gemini/OpenAI/Lovable public AI routing markers in production source");
console.log("- server chat endpoint is retired/fail-closed");
console.log("- Web Locks + BroadcastChannel single-engine coordination is present");
console.log("- WebGPU model storage remains IndexedDB");
console.log("- desktop local-model pull retries automatically");
console.log("- offline shell retry hook is present");
