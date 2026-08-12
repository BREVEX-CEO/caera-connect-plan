/**
 * Stage 1 of tool routing: decide WHICH KIND of help a request needs, before
 * loading a single tool schema.
 *
 * THE PROBLEM THIS SOLVES
 * -----------------------
 * A complete OCADE tool catalogue — browser, desktop, files, system, research,
 * connectors, devices — is several thousand tokens of JSON schema. Sending all
 * of it on every turn costs context that the actual conversation needs, slows
 * the first token on a local 8B model measurably, and measurably worsens
 * choices: a model shown eighty tools picks the wrong one far more often than a
 * model shown six.
 *
 * So the router runs first and cheaply. It answers one question — which
 * domains? — and only those domains' schemas are loaded in stage 2.
 *
 * WHY A KEYWORD PASS EXISTS ALONGSIDE THE MODEL
 * ---------------------------------------------
 * Not as a shortcut, but as a floor. "stop", "what's on my screen" and "open
 * chrome" must classify correctly even when the model is cold, busy or
 * mid-download. The deterministic pass handles the unambiguous cases in under a
 * millisecond and defers everything else to the model, which is where genuine
 * ambiguity belongs. It is a fast path, never an override: when the
 * deterministic pass is unsure it returns nothing rather than guessing.
 */

export const DOMAINS = [
  "os_app",
  "files",
  "content",
  "web",
  "connectors",
  "cross_device",
  "conversation",
] as const;

export type Domain = (typeof DOMAINS)[number];

export const DOMAIN_LABELS: Record<Domain, string> = {
  os_app: "operating system and application control",
  files: "finding and organising files",
  content: "creating documents, media and other output",
  web: "browsing and researching on the web",
  connectors: "connected services and smart-home",
  cross_device: "phones and other paired devices",
  conversation: "answering directly, with no tools",
};

export interface Classification {
  domains: Domain[];
  /** How the decision was reached, so a surprising route can be explained. */
  basis: "deterministic" | "model" | "fallback";
  /** Present when the model was asked and produced something unusable. */
  note?: string;
}

/*
 * Deliberately narrow. Each entry is a phrase that cannot reasonably mean
 * anything else — "screen" alone is ambiguous ("share your screen", "screen
 * these applicants"), "on my screen" is not.
 */
const CERTAIN: { pattern: RegExp; domains: Domain[] }[] = [
  {
    pattern: /\bon (my|the) screen\b|\bwhat do you see\b|\bwhat can you see\b/i,
    domains: ["os_app"],
  },
  { pattern: /\b(click|press|tap) (the )?[\w ]{1,30}\b(button)?\b/i, domains: ["os_app"] },
  { pattern: /\bopen (chrome|edge|a browser|the browser)\b/i, domains: ["web", "os_app"] },
  /*
   * Opening or focusing an application, whatever it is called.
   *
   * FOUND LIVE: "open notepad and type hello" matched nothing here and fell
   * through to the model — a two-word instruction that the router should have
   * answered instantly cost a full classification turn before any work began.
   * The browser rule above stays: it adds `web` as well, and the domains of
   * every matching rule are unioned.
   */
  {
    pattern: /\b(open|launch|start|run|focus|switch to|bring up)\s+[\w.\-+ ]{2,40}\b/i,
    domains: ["os_app"],
  },
  { pattern: /\btype\b|\bpress (enter|tab|escape|the \w+ key)\b/i, domains: ["os_app"] },
  /*
   * Searching the WEB, and not the user's own machine.
   *
   * FOUND LIVE: "search my documents for invoices" classified as `web`. The
   * user asked about files on their own disk and OCADE would have been given
   * only browser tools and gone looking on the internet for them. The lookahead
   * refuses the match when the object of the search is plainly local, and the
   * files rule below then claims it.
   */
  {
    pattern:
      /\b(search|google|look up)\b(?!.*\b(my|this|the) (documents?|files?|folders?|desktop|downloads?|pictures?|computer|pc|machine|drive)\b)/i,
    domains: ["web"],
  },
  { pattern: /\b(browse|navigate) to\b|\bgo to https?:\/\//i, domains: ["web"] },
  {
    pattern:
      /\b(find|locate|search) (my|the|a|all|through)? ?(file|files|document|documents|folder|folders|pdf|pdfs|spreadsheet|desktop|downloads)\b/i,
    domains: ["files"],
  },
  /*
   * Writing something down.
   *
   * FOUND LIVE, AND IT IS THE WHOLE REASON MULTI-STEP TASKS STALLED.
   *
   * "Check how much memory this computer is using, then save that number into
   * a file called memory-check.txt" matched only the `memory` rule below, so
   * the mission was given `os_app` tools alone. `workspace_write` lives in
   * `files`, so it was never in the vocabulary the model could see.
   *
   * The model did exactly the right thing: it read the memory, found no tool
   * that could write a file, and answered in prose. The loop saw a turn with
   * no tool call, and — because the only step so far was a read, so no
   * mutation existed to fail verification — ended the run reported as
   * "verified". A task half done, called done.
   *
   * The lesson is in the shape rather than the words: a request that spans two
   * domains needs BOTH, and every rule here fires independently and is unioned
   * for exactly that reason. A rule that covers only the first half of a
   * sentence is worse than no rule, because it looks like it worked.
   */
  {
    pattern:
      /\b(save|write|store|put|record|note|jot)\b.{0,40}\b(to|in|into|as)\b.{0,20}\b(a )?(file|note|txt|text file|document)\b/i,
    domains: ["files"],
  },
  {
    pattern: /\b(file|note) called\b|\bcalled [\w-]+\.(txt|md|csv|json|log)\b/i,
    domains: ["files"],
  },
  {
    pattern: /\b(organis|organiz)e (these|my|the) (files|photos|documents|downloads)\b/i,
    domains: ["files"],
  },
  {
    pattern:
      /\b(copy|move|rename|delete|trash|restore)\b.{0,30}\b(file|files|folder|document|documents)\b/i,
    domains: ["files"],
  },
  {
    pattern: /\b(volume|brightness|battery|cpu|ram|memory|disk space|running (apps|programs))\b/i,
    domains: ["os_app"],
  },
  {
    pattern: /\b(make my (pc|computer) faster|why is my (pc|computer) slow)\b/i,
    domains: ["os_app"],
  },
  { pattern: /\b(fix|explain) (this |the )?error\b/i, domains: ["os_app", "web"] },
  { pattern: /\b(on my phone|my android|my iphone|paired device)\b/i, domains: ["cross_device"] },
  {
    pattern: /\b(home assistant|slack|github issue|smart (light|home))\b/i,
    domains: ["connectors"],
  },
];

/** Sub-millisecond pass. Returns null when the request is genuinely ambiguous. */
export function classifyDeterministic(request: string): Domain[] | null {
  const text = request.trim();
  if (!text) return null;
  const hit = new Set<Domain>();
  for (const rule of CERTAIN) {
    if (rule.pattern.test(text)) rule.domains.forEach((d) => hit.add(d));
  }
  return hit.size > 0 ? [...hit] : null;
}

/**
 * The classification prompt.
 *
 * Constrained hard: a fixed list, JSON only, and an explicit instruction to
 * choose `conversation` when no tool is needed. A classifier that reaches for
 * a tool domain on "how are you" makes every greeting slow and, worse, tempts
 * the model into taking an action nobody asked for.
 */
export function classificationPrompt(request: string): string {
  const options = DOMAINS.map((d) => `- ${d}: ${DOMAIN_LABELS[d]}`).join("\n");
  return [
    "Classify the user's request into one or more capability domains.",
    "",
    "Domains:",
    options,
    "",
    'Answer with JSON only, in the form {"domains":["..."]}.',
    'Choose "conversation" alone when the request can be answered by talking, with no access to the computer.',
    "Choose every domain the request genuinely needs, and no others.",
    "",
    `Request: ${request.slice(0, 600)}`,
  ].join("\n");
}

/**
 * Read the model's answer without trusting its formatting.
 *
 * Small local models wrap JSON in prose, in code fences, and occasionally in a
 * `<think>` block. Extracting the first balanced object and keeping only known
 * domain names means a chatty reply still classifies correctly, and an invented
 * domain name is dropped rather than propagated into tool loading.
 */
export function parseClassification(reply: string): Domain[] | null {
  const withoutThinking = reply.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const match = /\{[\s\S]*?\}/.exec(withoutThinking);
  if (!match) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }
  const raw = (parsed as { domains?: unknown })?.domains;
  if (!Array.isArray(raw)) return null;
  const known = raw
    .map((d) => String(d).trim().toLowerCase())
    .filter((d): d is Domain => (DOMAINS as readonly string[]).includes(d));
  return known.length > 0 ? [...new Set(known)] : null;
}

export interface ClassifyDeps {
  /** One short, non-streaming completion. Returns null when unavailable. */
  complete: (prompt: string, signal?: AbortSignal) => Promise<string | null>;
}

/**
 * Classify a request. Deterministic first, model second, conversation last.
 *
 * Never throws and never returns an empty list: a classifier that fails should
 * degrade to plain conversation, which is safe, rather than to "all tools",
 * which is the thing this whole stage exists to avoid.
 */
export async function classify(
  request: string,
  deps: ClassifyDeps,
  signal?: AbortSignal,
): Promise<Classification> {
  const quick = classifyDeterministic(request);
  if (quick) return { domains: quick, basis: "deterministic" };

  let reply: string | null = null;
  try {
    reply = await deps.complete(classificationPrompt(request), signal);
  } catch {
    return {
      domains: ["conversation"],
      basis: "fallback",
      note: "The classifier could not be reached, so OCADE answered without tools.",
    };
  }

  const parsed = reply ? parseClassification(reply) : null;
  if (!parsed) {
    return {
      domains: ["conversation"],
      basis: "fallback",
      note: "The classifier did not return a usable answer, so OCADE answered without tools.",
    };
  }
  return { domains: parsed, basis: "model" };
}
