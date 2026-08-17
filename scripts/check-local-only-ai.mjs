import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN = ["src", ".env.example"];
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  "coverage",
  "__tests__",
  "tests",
  "test",
  "fixtures",
  "stories",
]);

// Concrete remote-AI execution markers. Generic words such as "cloud" are not
// forbidden because non-AI services (for example private sync) may use a network.
const FORBIDDEN = [
  [/OPENAI_API_KEY/g, "OpenAI chat API key"],
  [/LOVABLE_API_KEY/g, "Lovable AI gateway API key"],
  [/https:\/\/api\.openai\.com/gi, "OpenAI public AI endpoint"],
  [/https:\/\/ai\.gateway\.lovable\.dev/gi, "Lovable public AI gateway"],
  [/google\/gemini-[\w.-]+/gi, "Gemini cloud model id"],
  [/openai\/gpt-[\w.-]+/gi, "OpenAI cloud model id"],
  [/createOpenAIDirectGateway/g, "OpenAI cloud gateway constructor"],
  [/createLovableGateway/g, "Lovable cloud gateway constructor"],
  [/from\s+["']@ai-sdk\/openai-compatible["']/g, "public cloud-compatible AI SDK import"],
  [/\bOCADE Cloud\b/g, "OCADE Cloud AI product path"],
];

const files = [];
function walk(path) {
  const stat = statSync(path);
  if (stat.isFile()) {
    if (!/\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(path)) files.push(path);
    return;
  }
  for (const name of readdirSync(path)) {
    if (SKIP_DIRS.has(name)) continue;
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
  ["src/lib/brain/adapters/shared-browser.ts", /ocade-browser-model-engine-v1/],
  ["src/lib/brain/adapters/shared-browser.ts", /navigator\.locks/],
  ["src/lib/brain/adapters/shared-browser.ts", /BroadcastChannel/],
  ["src/lib/brain/adapters/browser-webgpu.ts", /cacheBackend:\s*["']indexeddb["']/],
  ["src/lib/local/model-lifecycle.ts", /DEFAULT_PULL_ATTEMPTS\s*=\s*5/],
  ["public/sw.js", /OCADE_RETRY_OFFLINE_CACHE/],
  ["src/routes/_authenticated/ocade.tsx", /LocalOnlyChatWorkspace/],
  ["src/routes/_authenticated/ocade.models.tsx", /There is no Gemini, GPT\/OpenAI, Lovable/],
  // Landing-page instant-local contract: start inside a two-second visit, use
  // the SAME Web Lock as Chat, cache through the browser-local adapter, release
  // RAM/GPU after warming, and ask for persistent application storage.
  ["src/lib/brain/landing-model-warmup.ts", /LANDING_MODEL_WARMUP_DELAY_MS\s*=\s*900/],
  ["src/lib/brain/landing-model-warmup.ts", /ocade-browser-model-engine-v1/],
  ["src/lib/brain/landing-model-warmup.ts", /BrowserWebGpuAdapter/],
  ["src/lib/brain/landing-model-warmup.ts", /await adapter\.dispose\(\)/],
  ["src/lib/brain/landing-model-warmup.ts", /storage\?\.persist\?\.\(\)/],
  ["src/lib/brain/landing-model-warmup.ts", /saveData/],
  ["src/routes/index.tsx", /LandingModelWarmup/],
  ["src/routes/index.tsx", /CosmicInteractionLayer/],
  ["src/components/landing/SolarSystem.tsx", /CLICK_TRAVEL_PX/],
  ["src/components/landing/SolarSystem.tsx", /scene\.zoom\(-260\)/],
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
console.log("- authenticated chat is local-only and server chat is retired/fail-closed");
console.log("- Web Locks + BroadcastChannel single-engine coordination is present");
console.log("- WebGPU model storage remains IndexedDB");
console.log("- desktop local-model pull retries automatically");
console.log("- offline shell retry hook is present");
console.log("- landing page starts a Save-Data-aware local model warm cache inside two seconds");
console.log("- landing warm cache reuses the browser-engine lock and releases RAM/GPU after warming");
console.log("- cinematic landing interactions remain pointer-transparent over the real WebGL scene");
