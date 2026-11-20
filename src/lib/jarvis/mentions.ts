/**
 * THE @ PICKER'S LOGIC (plan 14E.3), KEPT PURE SO IT CAN BE TESTED WITHOUT A BROWSER.
 *
 * Typing `@` in the JARVIS composer offers one list of resources: the apps the selected computer
 * reports, the websites allowed on it, and the tool servers (MCP) approved on it. Picking an app
 * inserts `@<exe>`, which is exactly the form the planner and the database already read to limit a
 * task to the apps it names (`taskApps`, `jarvis_app_in_scope`); a website or tool server is named
 * the same way and only tells the planner what to use. A mention never grants anything: a
 * resource that is not allowed on that computer is shown as needing permission, and the authority
 * refuses actions for it whatever the text says.
 */

export type ResourceKind = "app" | "website" | "tools";

export interface InstalledApp {
  name: string;
  exe: string;
  kind?: ResourceKind;
}

/**
 * Every resource the picker can name on one computer: its apps, its allowed websites and its
 * approved tool servers. A website or tool server is listed only once allowed or approved, so
 * nothing about another computer or account can appear.
 */
export function deviceResources(
  apps: readonly InstalledApp[],
  grants: readonly string[],
  mcp: readonly { id?: unknown; publisher?: unknown }[],
): InstalledApp[] {
  return [
    ...apps.map((app) => ({ ...app, kind: "app" as const })),
    ...grants
      .filter((grant) => grant.startsWith("site:"))
      .map((grant) => ({ name: grant.slice(5), exe: grant.slice(5), kind: "website" as const })),
    ...mcp
      // The companion reports only the servers its person approved (catalog.describe).
      .filter(
        (server) => typeof server.id === "string" && /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(server.id),
      )
      .map((server) => ({
        name:
          typeof server.publisher === "string"
            ? `${server.id} (${server.publisher})`
            : String(server.id),
        exe: `mcp:${String(server.id)}`,
        kind: "tools" as const,
      })),
  ];
}

/** Whether a resource may be named: an app needs its permission; the others are listed only when allowed. */
const permitted = (app: InstalledApp, allowed: ReadonlySet<string>) =>
  (app.kind ?? "app") !== "app" || allowed.has(`app:${app.exe}`);

export interface MentionCandidate extends InstalledApp {
  allowed: boolean;
}

/** The `@word` being typed immediately before the caret, or null. */
export function mentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const match = /(^|\s)@([^\s@]{0,80})$/.exec(before);
  if (!match) return null;
  return { start: caret - match[2]!.length - 1, query: match[2]! };
}

/** Lower-case letters and digits only, so "Excel", "excel.exe" and "EXCEL" compare alike. */
function fold(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * How well `query` matches a name: 0 is no match. A prefix beats a word start, which beats a
 * substring, which beats letters in order (so "pwp" finds "PowerPoint").
 */
export function matchScore(query: string, app: InstalledApp): number {
  const q = fold(query);
  if (!q) return 1;
  let best = 0;
  // The program's extension says nothing about which app it is: "ex" must not find "powerpnt.exe".
  for (const label of [app.name, app.exe.replace(/\.(exe|app)$/i, "").replace(/^mcp:/, "")]) {
    const folded = fold(label);
    if (folded.startsWith(q)) best = Math.max(best, 4);
    else if (
      label
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .some((word) => word.startsWith(q))
    ) {
      best = Math.max(best, 3);
    } else if (folded.includes(q)) best = Math.max(best, 2);
    else {
      let at = 0;
      for (const ch of folded) if (ch === q[at]) at += 1;
      if (at === q.length) best = Math.max(best, 1);
    }
  }
  return best;
}

/**
 * Candidates for a query: allowed apps first, then better matches, then by name. Duplicate
 * programs (one exe reported twice) appear once.
 */
export function rankApps(
  apps: readonly InstalledApp[],
  allowed: ReadonlySet<string>,
  query: string,
  limit = 8,
): MentionCandidate[] {
  const seen = new Set<string>();
  const scored: { app: MentionCandidate; score: number }[] = [];
  for (const app of apps) {
    if (seen.has(app.exe)) continue;
    seen.add(app.exe);
    const score = matchScore(query, app);
    if (score > 0) scored.push({ app: { ...app, allowed: permitted(app, allowed) }, score });
  }
  scored.sort(
    (a, b) =>
      Number(b.app.allowed) - Number(a.app.allowed) ||
      b.score - a.score ||
      a.app.name.localeCompare(b.app.name),
  );
  return scored.slice(0, limit).map(({ app }) => app);
}

/** The text with the typed `@word` replaced by `@exe ` and the caret placed after it. */
export function insertMention(
  text: string,
  start: number,
  caret: number,
  exe: string,
): { text: string; caret: number } {
  const inserted = `@${exe} `;
  const after = text.slice(caret).replace(/^\s+/, "");
  return { text: text.slice(0, start) + inserted + after, caret: start + inserted.length };
}
