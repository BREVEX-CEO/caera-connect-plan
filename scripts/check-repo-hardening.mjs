#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const productionFiles = [];
const skip = new Set(["node_modules", "dist", "coverage", ".git", "__tests__", "tests", "test", "fixtures"]);
function walk(path) {
  if (!existsSync(path)) return;
  const stat = statSync(path);
  if (stat.isFile()) {
    if (/\.(?:ts|tsx|js|mjs|css)$/i.test(path) && !/\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(path)) productionFiles.push(path);
    return;
  }
  for (const entry of readdirSync(path)) {
    if (!skip.has(entry)) walk(join(path, entry));
  }
}
walk(join(root, "src"));
walk(join(root, "public"));

const forbidden = [
  [/OPENAI_API_KEY/g, "OpenAI API key usage"],
  [/LOVABLE_API_KEY/g, "Lovable AI key usage"],
  [/https:\/\/api\.openai\.com/gi, "OpenAI public inference endpoint"],
  [/https:\/\/ai\.gateway\.lovable\.dev/gi, "Lovable public inference endpoint"],
  [/createOpenAIDirectGateway/g, "OpenAI gateway constructor"],
  [/createLovableGateway/g, "Lovable gateway constructor"],
  [/google\/gemini-[\w.-]+/gi, "Gemini cloud model id"],
  [/openai\/gpt-[\w.-]+/gi, "OpenAI cloud model id"],
];

const errors = [];
for (const file of productionFiles) {
  const text = readFileSync(file, "utf8");
  for (const [pattern, label] of forbidden) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) errors.push(`${relative(root, file)}: ${label}`);
  }
}

const required = [
  ["src/routes/api/ocade.chat.ts", /status:\s*410/],
  ["src/routes/_authenticated/ocade.index.tsx", /LocalOnlyChatWorkspace/],
  ["src/routes/index.tsx", /CosmicInteractionLayer/],
  ["src/routes/index.tsx", /HiddenSignature/],
  ["src/components/landing/HiddenSignature.tsx", /HAANS[\s\S]*44[\s\S]*28/],
  ["src/motion-upgrades.css", /opacity:\s*0\.05\s*;/],
  ["src/lib/brain/adapters/shared-browser.ts", /BroadcastChannel/],
  ["src/lib/brain/adapters/shared-browser.ts", /locks/],
  ["public/sw.js", /OCADE_RETRY_OFFLINE_CACHE/],
  ["src/lib/perf-fallback.ts", /memoryGb\s*<=\s*2/],
  ["src/lib/perf-fallback.ts", /cores\s*<=\s*2/],
];
for (const [file, pattern] of required) {
  if (!existsSync(file)) {
    errors.push(`${file}: required hardening file is missing`);
    continue;
  }
  if (!pattern.test(readFileSync(file, "utf8"))) errors.push(`${file}: missing required contract ${pattern}`);
}

const report = {
  scannedProductionFiles: productionFiles.length,
  errors: errors.length,
  details: errors,
};
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exit(1);
