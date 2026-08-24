/**
 * How big is the constitution, really, for each model that ships?
 *
 * The instruction is to measure rather than guess. Token counts here are
 * estimated from bytes because the browser tokenizers are not loadable in
 * Node, but the ratio for English prose with a Qwen BPE vocabulary is stable
 * around 3.6-4.0 bytes per token; the conservative end is used so the answer
 * errs towards "too big" rather than "fits".
 */
import { readFileSync } from "node:fs";

const BYTES_PER_TOKEN = 3.6; // conservative: more tokens per byte
const prompt = readFileSync("src/prompts/OCADE_SYSTEM_PROMPT.md", "utf8").trim();

const sections = [];
{
  let name = "(preamble)";
  let buf = [];
  for (const line of prompt.split("\n")) {
    const m = /^# ([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(line);
    if (m) {
      sections.push({ name, text: buf.join("\n") });
      name = m[1];
      buf = [line];
    } else buf.push(line);
  }
  sections.push({ name, text: buf.join("\n") });
}

const tok = (s) => Math.ceil(Buffer.byteLength(s, "utf8") / BYTES_PER_TOKEN);

// Context windows the shipping browser models actually expose.
const MODELS = [
  { label: "OCADE Browser (WebGPU, Qwen2.5-1.5B)", context: 4096 },
  { label: "OCADE Browser Plus (WebGPU, Qwen2.5-3B)", context: 4096 },
  { label: "OCADE Browser compatibility (WASM, Qwen2.5-1.5B)", context: 4096 },
];

const total = tok(prompt);
console.log(`FULL CONSTITUTION: ${Buffer.byteLength(prompt)} bytes ≈ ${total} tokens\n`);
console.log("Per section:");
for (const s of sections.sort((a, b) => tok(b.text) - tok(a.text))) {
  console.log(`  ${String(tok(s.text)).padStart(6)} tok  ${s.name}`);
}
console.log("\nAgainst each shipping model (leaving 1024 tokens for the conversation):");
for (const m of MODELS) {
  const budget = m.context - 1024;
  console.log(
    `  ${m.label}\n    context ${m.context}, budget for system ${budget}, full prompt needs ${total} -> ${total <= budget ? "FITS" : `OVER by ${total - budget}`}`,
  );
}
