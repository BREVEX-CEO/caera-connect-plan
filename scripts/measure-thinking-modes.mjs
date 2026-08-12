/**
 * Which thinking mode actually produces clean tool calls, and how fast.
 *
 * WHY THIS IS MEASURED AND NOT ASSUMED
 * ------------------------------------
 * The obvious belief is that `think: false` is faster because the model stops
 * reasoning. On this machine that turned out to be wrong in a way that matters:
 * qwen3:4b kept reasoning and put the reasoning in `message.content`, so the
 * turn was just as slow AND the answer arrived wrapped in "Hmm, the user just
 * asked me to..." — which a tool-call parser cannot use.
 *
 * That is the whole reason for this script. The flag we want is the one that
 * yields a PARSEABLE tool call soonest, which is not necessarily the one that
 * sounds fastest. It reports both numbers separately so the choice is made on
 * evidence rather than on the name of the option.
 *
 * Usage: node scripts/measure-thinking-modes.mjs [--runs 3]
 */

const BRIDGE = process.env.OCADE_BRIDGE_URL ?? "http://127.0.0.1:11434";
const MODEL = "qwen3:4b";
const RUNS = Number(process.argv[process.argv.indexOf("--runs") + 1]) || 3;

/** A real Control + Work turn: one instruction, one tool, one expected call. */
const TOOLS = [
  {
    type: "function",
    function: {
      name: "app_open",
      description: "Open an installed application by name.",
      parameters: {
        type: "object",
        properties: { name: { type: "string", description: "The application's name." } },
        required: ["name"],
      },
    },
  },
];

const SYSTEM = "You control a computer. Call exactly one tool. Never explain, never narrate.";
const PROMPT = "Open Notepad.";

async function turn({ think, noThinkToken, noThinkInSystem, predict }) {
  const started = Date.now();
  const system = noThinkInSystem ? `${SYSTEM} /no_think` : SYSTEM;
  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: noThinkToken ? `${PROMPT} /no_think` : PROMPT },
    ],
    tools: TOOLS,
    stream: false,
    keep_alive: -1,
    options: { num_predict: predict ?? 200, temperature: 0 },
  };
  if (think !== undefined) body.think = think;

  const response = await fetch(`${BRIDGE}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);

  const json = await response.json();
  const message = json.message ?? {};
  const calls = message.tool_calls ?? [];
  const content = (message.content ?? "").trim();

  return {
    ms: Date.now() - started,
    // The only question that matters: did a usable call come back?
    clean: calls.length === 1 && calls[0]?.function?.name === "app_open",
    args: calls[0]?.function?.arguments ?? null,
    // Reasoning that lands in `content` alongside a tool call is the failure
    // mode this script exists to catch.
    leakedChars: content.length,
    leakSample: content.slice(0, 80),
    thinkingField: (message.thinking ?? "").length,
  };
}

const MODES = [
  { label: "think:false", options: { think: false } },
  { label: "think:true", options: { think: true } },
  { label: "think omitted", options: {} },
  { label: "think:false + /no_think", options: { think: false, noThinkToken: true } },
  // The user's own words must never carry a control token: "/no_think" once
  // ended up inside a YouTube search box because it was appended to the
  // prompt. Putting it in the system message keeps it out of the text
  // entirely, which is the only version safe to ship.
  {
    label: "system /no_think",
    options: { think: false, noThinkInSystem: true },
  },
  // Dropped: num_predict 96 truncated the tool call itself, so it was the
  // fastest and also 0/3 usable. A cap below the length of a complete call is
  // not a speed setting, it is a corruption setting.
];

console.log(`model=${MODEL}  runs=${RUNS}  bridge=${BRIDGE}\n`);

/*
 * Warm up properly, and say why.
 *
 * The first version of this script did one warm-up turn and reported ~19 s
 * medians. Re-running it minutes later on an identical tree reported ~11 s for
 * the same mode. The difference was not the mode — it was the weights loading,
 * charged entirely to whichever mode happened to run first.
 *
 * A benchmark whose answer depends on which row is at the top of the table is
 * not measuring what it claims to. Three warm-ups, and `keep_alive: -1` on
 * every request, so the model is resident before the first timed turn.
 */
try {
  for (let i = 0; i < 3; i += 1) await turn({ think: false });
} catch (error) {
  console.error(`Cannot reach Ollama at ${BRIDGE}: ${error.message}`);
  process.exit(1);
}

const table = [];
for (const mode of MODES) {
  const runs = [];
  for (let i = 0; i < RUNS; i += 1) runs.push(await turn(mode.options));

  const times = runs.map((r) => r.ms).sort((a, b) => a - b);
  table.push({
    mode: mode.label,
    median: times[Math.floor(times.length / 2)],
    best: times[0],
    worst: times[times.length - 1],
    clean: `${runs.filter((r) => r.clean).length}/${RUNS}`,
    leaked: Math.round(runs.reduce((sum, r) => sum + r.leakedChars, 0) / RUNS),
    thinking: Math.round(runs.reduce((sum, r) => sum + r.thinkingField, 0) / RUNS),
  });
  const sample = runs.find((r) => r.leakedChars > 0);
  if (sample)
    console.log(`  ${mode.label} leaked into content: ${JSON.stringify(sample.leakSample)}`);
}

console.log();
console.table(table);
console.log(
  "\nclean   = turns that returned exactly one parseable app_open call",
  "\nleaked  = mean characters of prose in message.content (0 is what we want)",
  "\nthinking= mean characters in message.thinking, which is separate and fine",
);

const usable = table.filter((row) => row.clean === `${RUNS}/${RUNS}`);
if (usable.length === 0) {
  console.log("\nNo mode produced clean tool calls every time on this machine.");
} else {
  const fastest = usable.sort((a, b) => a.median - b.median)[0];
  console.log(
    `\nFastest mode that is ALWAYS clean: ${fastest.mode} at ${fastest.median} ms median.`,
  );
}
