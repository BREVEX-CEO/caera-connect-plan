import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDirectory = join(repoRoot, ".output", "public");
const assetsDirectory = join(publicDirectory, "assets");

/**
 * Budgets for THE APPLICATION.
 *
 * These used to be described as "everything a user downloads to open OCADE",
 * but that is not what they measured: they summed every application chunk,
 * eager and lazy alike. Measured against this tree, the two quantities are not
 * close — 828 KiB is reachable from the entry, and 3,105 KiB is behind a lazy
 * boundary and downloaded only by someone who opens the thing that needs it:
 *
 *   538.9 KiB  the landing hero's three.js scene   (lazy)
 *   (mammoth was removed: 485.6 KiB of library for one `extractRawText`
 *    call, replaced by the same OOXML reading the spreadsheet decoder
 *    already does — see `extractDocxText` in `ocade-decoders.ts`.)
 *   417.7 KiB  pdfjs-dist                          (lazy)
 *
 * So the number that actually protects a first paint was never gated at all,
 * while the aggregate slowly grew past a ceiling nobody re-based — and the gate
 * has been failing, in CI, on the deploy path.
 *
 * Both are now enforced, and the tight one is the one that matters:
 *
 *  - EAGER_BUDGETS bound what a visitor downloads before OCADE is usable. This
 *    guarantee is new; nothing checked it for application chunks before.
 *  - The aggregate below is re-based on measurement and kept as a growth bound,
 *    so a library landing in the tree is still noticed.
 *
 * Every number is measured-plus-headroom, and the measurement is in the comment
 * so a future change can argue with it rather than trust it.
 */
const budgets = Object.freeze({
  assetFiles: 250,
  /*
   * THESE ARE THE PLAN'S NUMBERS NOW, NOT MEASURED-PLUS-HEADROOM.
   *
   * WHAT THEY WERE, AND WHY THAT WAS WRONG. These three had been re-based on
   * measurement with roughly 3% headroom — 4,680,000 / 4,520,000 / 156,000 —
   * with an argument that the tree had legitimately grown. The argument was
   * reasonable and the effect was not: `PLAN.md` §26 requires total JavaScript
   * at or under 4,200 KiB and CSS at or under 145 KiB, so a gate set above
   * those numbers reported a passing build while the requirement was unmet.
   * A budget that moves to wherever the bundle sits is a record of the bundle,
   * not a limit on it.
   *
   * The tree was brought under the plan rather than the plan brought up to the
   * tree, and both moves are worth knowing because both recur:
   *
   *   - `mammoth` was removed. 485.6 KiB of library for a single
   *     `extractRawText` call, whose whole job is to discard formatting and
   *     return plain text. The spreadsheet decoder already read OOXML archives
   *     with no dependency at all, so the DOCX reader now does the same thing
   *     the same way. Total JavaScript fell from 4,520 KiB to 3,927 KiB.
   *   - The stylesheet is minified with Lightning CSS rather than esbuild, and
   *     Tailwind no longer scans the test directories — four hundred test files
   *     quoting class names in assertions were generating real utilities that
   *     shipped to every visitor. CSS fell from 150,669 to 147,986 bytes.
   */
  totalBytes: 4_450_000,
  javascriptBytes: 4_300_800,
  cssBytes: 148_480,
  // Measured largest: the lazy three.js hero at 538.9 KiB.
  largestJavascriptBytes: 600_000,
});

/**
 * What a visitor downloads BEFORE the application is usable — the entry chunk
 * and everything reachable from it by static import. Kept deliberately tight:
 * the failure this catches is a heavy library losing its lazy boundary and
 * landing on the first paint, which is precisely how a 1.2 MB document chunk
 * once ended up there.
 *
 * THESE ARE THE PLAN'S NUMBERS, NOT MEASURED-PLUS-HEADROOM.
 *
 * The rest of this file is re-based on measurement, and says so. These two are
 * not: `PLAN.md` §26 requires eager JavaScript ≤850 KiB and the largest eager
 * chunk ≤450 KiB, so the gate enforces the requirement rather than wherever the
 * tree happens to sit. Headroom on a first-paint budget is an invitation, and
 * the previous 520 KiB allowance was taken up exactly that way — the entry
 * chunk reached 508 KiB, 58 KiB past what the plan permits, without ever
 * failing.
 *
 * Measured on the current tree: 832.5 KiB across 5 chunks, largest 444.7 KiB.
 * It got there by moving four things off the static import graph, each of which
 * is worth knowing about because each is a shape that recurs:
 *
 *   - the terms and privacy prose, behind the dialog that shows it;
 *   - the solar-system module, which the shared depth scene was pulling in for
 *     one small pure function (now `landing/render-tier.ts`);
 *   - the companion stack and the storage resolver, both imported only for
 *     sign-out cleanup, and both safe to defer because the state they clear
 *     cannot exist unless the module is already in memory.
 */
const EAGER_BUDGETS = Object.freeze({
  bytes: 870_400,
  largestBytes: 460_800,
});

/**
 * The on-device inference engines are measured SEPARATELY, and this needs
 * justifying rather than assuming.
 *
 * Under the single total above these failed the budget by 6x, which read as
 * "the app got 6x heavier". It did not: the application chunks still measure
 * ~3.5 MiB and pass their own limits untouched.
 *
 * The split is only legitimate while these chunks are genuinely unreachable
 * from the entry graph — a user who never routes to a browser engine must
 * never download one. That is not assumed here; `ENGINE_PATTERN` chunks are
 * walked against the entry's STATIC import graph below, and finding one there
 * fails the gate. So this is a stricter guarantee than the number it replaced,
 * not a relaxed one.
 *
 * MEASURED COMPOSITION, so these numbers can be argued with rather than
 * trusted:
 *
 *   7.30 MiB  wllama's WebAssembly binary — one file, irreducible
 *   5.76 MiB  WebLLM runtime (main thread)
 *   5.75 MiB  WebLLM runtime (worker) — A DUPLICATE, see below
 *   0.28 MiB  wllama's JavaScript
 *
 * The duplication is real waste and is recorded rather than hidden: a module
 * worker cannot share the main chunk graph, so WebLLM is emitted twice. Only
 * the worker copy is used for inference; the main-thread copy is pulled in by
 * `CreateWebWorkerMLCEngine` and `prebuiltAppConfig`. Importing a narrower
 * entry point would likely remove ~5.7 MiB and is the obvious next reduction.
 */
const ENGINE_PATTERN = /^(lib-|webllm|wllama)/;
const engineBudgets = Object.freeze({
  // Headroom over the measured 19.1 MiB, not a number chosen to fit.
  bytes: 21_000_000,
  largestBytes: 8_000_000,
});

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

async function loadAssets() {
  let names;
  try {
    names = await readdir(assetsDirectory);
  } catch {
    throw new Error(
      "No production assets were found. Run `npm run build` before the performance budget check.",
    );
  }

  return Promise.all(
    names.map(async (name) => {
      const path = join(assetsDirectory, name);
      const details = await stat(path);
      return { name, path, bytes: details.size };
    }),
  );
}

const allAssets = (await loadAssets()).filter((asset) => asset.bytes > 0);

const engineAssets = allAssets.filter((asset) => ENGINE_PATTERN.test(asset.name));
const assets = allAssets.filter((asset) => !ENGINE_PATTERN.test(asset.name));
const javascript = assets.filter((asset) => asset.name.endsWith(".js"));
const css = assets.filter((asset) => asset.name.endsWith(".css"));
const totalBytes = assets.reduce((sum, asset) => sum + asset.bytes, 0);
const javascriptBytes = javascript.reduce((sum, asset) => sum + asset.bytes, 0);
const cssBytes = css.reduce((sum, asset) => sum + asset.bytes, 0);
const largestJavascript = javascript.reduce(
  (largest, asset) => (asset.bytes > largest.bytes ? asset : largest),
  { name: "none", path: "", bytes: 0 },
);
const staticImportsOf = (source) => {
  const found = new Set();
  const pattern = /(?:^|[;\s])import\s*(?:[^'"()]*?from\s*)?["']\.\/([^"']+)["']/g;
  let match;
  while ((match = pattern.exec(source))) found.add(match[1]);
  return found;
};

const assetNames = new Set(allAssets.map((asset) => asset.name));
const entryChunks = allAssets
  .filter((asset) => /^index-.*\.js$/.test(asset.name))
  .map((asset) => asset.name);
const staticallyReachable = new Set(entryChunks);
const walk = [...entryChunks];
while (walk.length > 0) {
  const name = walk.pop();
  let source;
  try {
    source = await readFile(join(assetsDirectory, name), "utf8");
  } catch {
    continue;
  }
  for (const dependency of staticImportsOf(source)) {
    if (assetNames.has(dependency) && !staticallyReachable.has(dependency)) {
      staticallyReachable.add(dependency);
      walk.push(dependency);
    }
  }
}

const failures = [];

function check(label, actual, limit) {
  if (actual > limit) failures.push(`${label}: ${actual} exceeds ${limit}.`);
}

/*
 * Cloudflare Workers rejects any individual static asset above 25 MiB. Vite's
 * emitted chunks all live under `assets/`, but copied public files do not. A
 * model placed in `public/models/`, for example, used to evade every size
 * check here and fail only during a later deployment upload.
 *
 * Scan the complete built public tree. This remains a deployment-portability
 * guard rather than a model-distribution authority: model weights belong on
 * an approved range-capable origin, and the normal build must not contain one.
 */
const MAX_WORKERS_STATIC_ASSET_BYTES = 25 * 1024 * 1024;

async function collectOversizedPublicFiles(directory, relative = "") {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const oversized = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    const shown = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      oversized.push(...(await collectOversizedPublicFiles(path, shown)));
    } else if (entry.isFile()) {
      const details = await stat(path);
      if (details.size > MAX_WORKERS_STATIC_ASSET_BYTES) {
        oversized.push({ name: shown, bytes: details.size });
      }
    }
  }
  return oversized;
}

const oversizedPublicFiles = await collectOversizedPublicFiles(publicDirectory);
for (const asset of oversizedPublicFiles) {
  failures.push(
    `${asset.name} is ${formatBytes(asset.bytes)}, over the 25 MiB Cloudflare Workers static-asset limit. ` +
      "Keep model weights and other large files on an approved external origin, not in public/.",
  );
}

check("Asset file count", assets.length, budgets.assetFiles);
check("Total asset bytes", totalBytes, budgets.totalBytes);
check("JavaScript bytes", javascriptBytes, budgets.javascriptBytes);
check("CSS bytes", cssBytes, budgets.cssBytes);
check("Largest JavaScript asset bytes", largestJavascript.bytes, budgets.largestJavascriptBytes);

/*
 * THE FIRST-PAINT GATE. Everything above bounds the tree as a whole; this
 * bounds what a visitor actually waits for, and it is the tighter of the two.
 */
const eagerJavascript = javascript.filter((asset) => staticallyReachable.has(asset.name));
const eagerBytes = eagerJavascript.reduce((sum, asset) => sum + asset.bytes, 0);
const largestEager = eagerJavascript.reduce(
  (largest, asset) => (asset.bytes > largest.bytes ? asset : largest),
  { name: "none", bytes: 0 },
);
check("Eager JavaScript bytes", eagerBytes, EAGER_BUDGETS.bytes);
check("Largest eager JavaScript asset bytes", largestEager.bytes, EAGER_BUDGETS.largestBytes);
if (eagerJavascript.length === 0) {
  // A gate that measured nothing must not report itself as one that passed.
  failures.push("No eager JavaScript was found, so the first-paint budget could not be verified.");
}

/*
 * The engines get their own ceiling — and, more importantly, must prove they
 * are lazy. An engine chunk reachable by STATIC import from the entry would
 * mean every visitor downloads megabytes of inference runtime to read a
 * marketing page, which is the exact failure the single total used to catch.
 */
const engineBytes = engineAssets.reduce((sum, asset) => sum + asset.bytes, 0);
const largestEngine = engineAssets.reduce(
  (largest, asset) => (asset.bytes > largest.bytes ? asset : largest),
  { name: "none", bytes: 0 },
);
check("On-device engine bytes", engineBytes, engineBudgets.bytes);
check("Largest engine asset bytes", largestEngine.bytes, engineBudgets.largestBytes);

const eagerEngines = engineAssets.filter((asset) => staticallyReachable.has(asset.name));
if (eagerEngines.length > 0) {
  failures.push(
    `On-device engine chunks must load lazily; these are in the entry graph: ${eagerEngines
      .map((asset) => asset.name)
      .join(", ")}.`,
  );
}
if (entryChunks.length === 0) {
  // Without an entry chunk the laziness check proves nothing, and a check that
  // cannot run must not be reported as one that passed.
  failures.push("No entry chunk was found, so engine laziness could not be verified.");
}

/*
 * THE SUPABASE CLIENT MUST NOT BE ON THE FIRST-PAINT PATH.
 *
 * 203 KiB of auth stack, for a visitor who opened the landing page and never
 * signed in. Every OCADE module that touches it loads it through
 * `loadSupabaseClient`, and that was not enough on its own — twice.
 *
 * The first time, the chunk boundary was in the wrong place rather than
 * missing: `auth-middleware` is registered globally by `src/start.ts`, so the
 * entry imported the Supabase CHUNK to reach the middleware, which is the same
 * 203 KiB by another route.
 *
 * The second time was worse, because the source graph was provably clean.
 * `tslib` has no chunk group of its own, `@supabase/*` reached it first, and it
 * was pulled into the Supabase chunk — so the entry carried a static import of
 * that chunk to get three helper functions, and no amount of reading the source
 * would have shown it. Only the built graph does.
 *
 * Which is why this is asserted HERE, against the emitted chunks, rather than
 * as a source-scanning test.
 */
const supabaseChunks = javascript.filter((asset) => /^vendor-supabase-/.test(asset.name));
const eagerSupabase = supabaseChunks.filter((asset) => staticallyReachable.has(asset.name));
if (eagerSupabase.length > 0) {
  failures.push(
    `The Supabase client must load lazily; these are in the entry graph: ${eagerSupabase
      .map((asset) => `${asset.name} (${(asset.bytes / 1024).toFixed(1)} KiB)`)
      .join(", ")}.`,
  );
}
if (supabaseChunks.length === 0) {
  // The chunk not existing at all would satisfy the test above for the wrong
  // reason — a renamed group, or a build that stopped splitting it.
  failures.push("No vendor-supabase chunk was found, so its laziness could not be verified.");
}

/*
 * THE HELP CENTER'S PROSE IS NOT FIRST-PAINT CONTENT, AND THE CHUNK GROUP ALONE
 * DOES NOT KEEP IT THAT WAY.
 *
 * `help-articles` has had a group of its own since the answers became
 * canonical, and it went eager anyway the day the Help Center gained a
 * publishing workflow: `useQuery` had no home above the feature groups, so the
 * help chunk adopted `@tanstack/react-query`, and the entry — which needs
 * react-query on every screen — had to import the help chunk to reach it.
 * Twenty-four kilobytes of help prose on the landing page, from one added
 * import.
 *
 * Same assertion shape as the Supabase one above, and for the same reason: the
 * group is the mechanism, and this is the property.
 */
const helpChunks = javascript.filter((asset) => /^help-articles-/.test(asset.name));
const eagerHelp = helpChunks.filter((asset) => staticallyReachable.has(asset.name));
if (eagerHelp.length > 0) {
  failures.push(
    `The Help Center's answers must load lazily; these are in the entry graph: ${eagerHelp
      .map((asset) => `${asset.name} (${(asset.bytes / 1024).toFixed(1)} KiB)`)
      .join(", ")}.`,
  );
}
if (helpChunks.length === 0) {
  failures.push("No help-articles chunk was found, so its laziness could not be verified.");
}

const pdfChunks = javascript.filter((asset) => /^pdf-[\w-]+\.js$/.test(asset.name));
if (pdfChunks.length !== 1) {
  failures.push(`Expected exactly one lazy PDF chunk, observed ${pdfChunks.length}.`);
}

/*
 * Route chunks are named after their route FILE — `ocade.index-<hash>.js`. This
 * filter used to be `startsWith("ocade-")`, which matches the library chunks
 * (`ocade-models`, `ocade-local`, `ocade-identity`) and never the route, so it
 * reported "observed 0" however healthy the boundary was. The lazy PDF import
 * has been in `ocade.index` throughout.
 */
const ocadeRouteCandidates = [];
for (const asset of javascript.filter((candidate) => /^ocade[.-]/.test(candidate.name))) {
  const source = await readFile(asset.path, "utf8");
  if (source.includes("__vite__mapDeps") && source.includes("pdf-")) {
    ocadeRouteCandidates.push(asset);
  }
}
if (ocadeRouteCandidates.length !== 1) {
  failures.push(
    `Expected one OCADE route with a lazy PDF dependency boundary, observed ${ocadeRouteCandidates.length}.`,
  );
}

/*
 * NO SOURCE MAPS IN A PRODUCTION BUNDLE.
 *
 * A `.map` file turns the shipped bundle back into the ORIGINAL tree: every
 * file name, every comment, every internal helper, laid out as written.
 * Shipping one alongside minified code hands over the source with the archive
 * already unpacked, and the licence in this repository forbids exactly the
 * reading it would enable.
 *
 * Checked here rather than set in `vite.config.ts` because the build ALREADY
 * gets this right -- it emits no maps and minifies to single-letter identifiers
 * on its own. An attempt to restate that as explicit `minify`/`sourcemap`
 * options made things strictly worse: this is rolldown-vite, `minify: "esbuild"`
 * turns off its native minifier, and the bundle grew from 3,751 KiB to 6,685
 * KiB while changing nothing about maps. The configuration was reverted and the
 * guarantee written down here as a test instead, which is the part that was
 * genuinely missing -- nothing failed the build if a future change started
 * emitting them.
 */
const sourceMaps = allAssets.filter((asset) => asset.name.endsWith(".map"));
if (sourceMaps.length > 0) {
  failures.push(
    `Source maps in the production bundle: ${sourceMaps.map((a) => a.name).join(", ")}`,
  );
}

console.log(
  [
    `Performance budget: ${assets.length}/${budgets.assetFiles} assets`,
    `oversized deployment assets ${oversizedPublicFiles.length} (must be 0)`,
    `source maps ${sourceMaps.length} (must be 0)`,
    `${formatBytes(totalBytes)}/${formatBytes(budgets.totalBytes)} total`,
    `${formatBytes(javascriptBytes)}/${formatBytes(budgets.javascriptBytes)} JavaScript`,
    `${formatBytes(eagerBytes)}/${formatBytes(EAGER_BUDGETS.bytes)} eager JavaScript (${eagerJavascript.length} chunks)`,
    `largest eager ${largestEager.name} ${formatBytes(largestEager.bytes)}/${formatBytes(EAGER_BUDGETS.largestBytes)}`,
    `${formatBytes(cssBytes)}/${formatBytes(budgets.cssBytes)} CSS`,
    `largest JS ${largestJavascript.name} ${formatBytes(largestJavascript.bytes)}/${formatBytes(budgets.largestJavascriptBytes)}`,
    `lazy PDF chunks ${pdfChunks.length}`,
    `on-device engines ${formatBytes(engineBytes)}/${formatBytes(engineBudgets.bytes)} (all lazy: ${eagerEngines.length === 0})`,
  ].join("\n"),
);

if (failures.length > 0) {
  throw new Error(`Production asset budget failed:\n- ${failures.join("\n- ")}`);
}
