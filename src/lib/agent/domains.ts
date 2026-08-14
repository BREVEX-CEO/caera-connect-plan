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
  /*
   * THIS LABEL USED TO SAY "answering directly, with no tools", AND IT STOPPED
   * BEING TRUE. `conversation` now carries the continuity layer — memory,
   * projects, the morning briefing, watched topics, the user's own name — so a
   * classifier told it means "no tools" would route "remember that I prefer
   * short answers" away from the one domain that can do it.
   *
   * It is still the domain that needs no access to the MACHINE, which is the
   * distinction that matters: nothing in it moves a mouse or opens a window.
   */
  conversation: "talking, and what OCADE remembers about the user between sessions",
};

export interface Classification {
  domains: Domain[];
  /**
   * How the decision was reached, so a surprising route can be explained.
   *
   * `caller` means classification never ran: the request was composed by OCADE
   * itself for a known purpose, so the domains came with it. See the `domains`
   * option on `runAgentTask`.
   */
  basis: "deterministic" | "model" | "fallback" | "caller";
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
  /*
   * CONTINUITY. Every phrase below is about what OCADE knows rather than what
   * the computer is doing, and each one was previously classified as `os_app`
   * (because "remember" contains no machine word either) or fell through to
   * `conversation`, which had no tools at all. Both routes ended the same way:
   * the model answered "I'll remember that" and nothing was written down.
   */
  {
    pattern:
      /\b(remember (that|this|i|my|to)|don'?t forget|make a note that|keep in mind that|note that i)\b/i,
    domains: ["conversation"],
  },
  {
    pattern: /\b(what do you (know|remember) about|do you remember|forget (that|what|about)|your memory)\b/i,
    domains: ["conversation"],
  },
  {
    pattern:
      /\b(brief(ing)? me|catch me up|what did i (do|work on)|where did we (leave|get) (off|to)|recap)\b/i,
    domains: ["conversation"],
  },
  {
    pattern: /\b(keep an eye on|watch (for|the )?news|follow (the )?(topic|story)|notify me (about|when))\b/i,
    domains: ["conversation"],
  },
  {
    pattern: /\b(call me|my name is|address me as|i'?m called|what should i call you|your name is|rename yourself|call yourself)\b/i,
    domains: ["conversation"],
  },
  {
    pattern: /\b(i'?m (working|building) on|my project|the project i'?m)\b/i,
    domains: ["conversation"],
  },
  // A reminder is a machine action (the OS scheduler) prompted by a
  // conversational sentence, so BOTH domains are needed: `os_app` has the tool
  // and `conversation` has the memory of what the user is doing.
  {
    pattern: /\bremind me\b|\bset a reminder\b|\bwake me\b|\bmy reminders\b/i,
    domains: ["os_app", "conversation"],
  },
  { pattern: /\b(weather|forecast|is it (going to )?rain)\b/i, domains: ["web"] },
  { pattern: /\bflights?\b.{0,30}\b(to|from)\b|\bfly (to|from)\b/i, domains: ["web"] },
  {
    pattern: /\b(news (on|about)|latest on|compare .+ (and|vs|versus)|how much (is|does)|price of)\b/i,
    domains: ["web"],
  },
  // Seeing. Only the phrasings that cannot mean the accessibility tree — a
  // request naming the CAMERA, or naming a window that draws its own pixels.
  {
    pattern: /\b(webcam|my camera|through the camera|what does the camera see)\b/i,
    domains: ["os_app"],
  },
  {
    pattern: /\b(review|debug|refactor|explain) (this |my |the )?(code|function|script|file)\b|\bwhat(?:'?s| is) wrong with (this|my) (code|function|script)\b/i,
    domains: ["files"],
  },
  {
    pattern: /\b(steam|epic games|my games)\b.{0,30}\b(update|updating|installed)\b|\bupdate my games\b/i,
    domains: ["os_app"],
  },
  {
    pattern: /\b(clipboard|what i (just )?copied|translate this|summarise this|summarize this)\b/i,
    domains: ["os_app", "conversation"],
  },
  {
    pattern: /\b(on my phone|from my phone|phone dashboard|pair my phone|qr code)\b/i,
    domains: ["os_app"],
  },
  {
    pattern: /\b(start (with|on) (windows|boot|login|start ?up)|launch at (start ?up|login)|auto ?start)\b/i,
    domains: ["os_app"],
  },
  {
    pattern: /\b(wifi|wi-fi|shut ?down|restart the (pc|computer)|reboot|lock the (pc|computer|screen)|go to sleep)\b/i,
    domains: ["os_app"],
  },
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
    'Choose "conversation" when the request is about talking, or about what OCADE should remember, recall or forget about the user — it needs no access to the computer itself.',
    "Choose every domain the request genuinely needs, and no others.",
    "A request that spans two domains needs both. Naming only the first half is worse than naming none.",
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
