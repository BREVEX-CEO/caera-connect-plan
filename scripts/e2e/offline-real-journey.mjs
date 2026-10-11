/**
 * Offline Intelligence, really installed and really answering with no network.
 *
 * `offline-journey.mjs` proves the surface; this proves the thing itself: the
 * published release is downloaded through OCADE's own delivery route, verified,
 * stored on the device, and then answers a question with the network cut off.
 * The artifact must already sit in the local test bucket (the cloud workflow
 * puts the real, digest-checked release there); without it this is BLOCKED.
 *
 * Usage: node scripts/e2e/offline-real-journey.mjs [--base=…] [--supabase=…]
 */
import { chromium } from "playwright-core";

const arg = (name, fallback) => {
  const found = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};

const BASE = arg("base", "http://127.0.0.1:8788");
const SUPABASE = arg("supabase", "http://127.0.0.1:54321");
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM || undefined;
const INSTALL_TIMEOUT_MS = 15 * 60_000;
const ANSWER_TIMEOUT_MS = 5 * 60_000;

let failures = 0;
function check(name, ok, detail = "") {
  if (!ok) failures += 1;
  process.stdout.write(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}\n`);
}

const storageKey = (url) => `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
const session = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: `offline-real-${Date.now()}@ocade.test`, password: "proof" }),
}).then((response) => response.json());

const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [storageKey(SUPABASE), JSON.stringify(session)],
  );
  const page = await context.newPage();
  // Every delivery of the artifact, from the first: preparation may start as the page opens.
  const delivered = [];
  page.on("response", (response) => {
    if (response.url().includes("/api/offline/bytes/")) delivered.push(response.status());
  });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

  /* --- the install, through the delivery route, to Ready ------------------- */
  const settings = async () => {
    await page.click('aside button[aria-haspopup="menu"]');
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Privacy & Security" }).click();
  };
  await settings();
  const install = page.getByRole("button", { name: "Install" });
  if (await install.count()) await install.click();
  const started = Date.now();
  let ready = false;
  let last = "";
  while (Date.now() - started < INSTALL_TIMEOUT_MS) {
    const panel = await page.getByRole("dialog", { name: "Settings" }).innerText();
    last =
      panel
        .split("\n")
        .find((line) =>
          /Ready|Downloading|Verifying|Preparing|could not|storage|cannot run/.test(line),
        ) ?? last;
    if (/\bReady\b/.test(panel)) {
      ready = true;
      break;
    }
    if (/could not|cannot run|more local storage/i.test(panel)) break;
    await page.waitForTimeout(2_000);
  }
  if (!ready && delivered.length === 0 && /could not|not available/i.test(last)) {
    process.stdout.write(
      `BLOCKED  offline-real journey — no release in the local bucket (${last})\n`,
    );
    process.exit(3);
  }
  check(
    "the published release installs through OCADE's own delivery route, to Ready",
    ready && delivered.length > 0 && delivered.every((status) => status === 200 || status === 206),
    `${last} · ${delivered.length} deliveries in ${Math.round((Date.now() - started) / 1000)} s`,
  );
  await page.keyboard.press("Escape");

  /* --- an answer with the network cut off ---------------------------------- */
  const ask = async (question) => {
    await page.getByRole("button", { name: "Offline", exact: true }).click();
    const transcript = page.locator("[data-transcript]");
    const before = (await transcript.innerText()).length;
    await page.fill("#ocade-composer", question);
    const asked = Date.now();
    await page.click('button[aria-label="Send"]');
    let text = "";
    let steady = 0;
    while (Date.now() - asked < ANSWER_TIMEOUT_MS) {
      await page.waitForTimeout(1_500);
      const now = (await transcript.innerText()).slice(before);
      steady = now === text && now.length > question.length + 1 ? steady + 1 : 0;
      text = now;
      // Settled: nothing new for a few seconds and Send is back.
      if (steady >= 2 && (await page.locator('button[aria-label="Send"]').count()) === 1) break;
    }
    return { answer: text.replace(question, "").trim(), seconds: (Date.now() - asked) / 1000 };
  };

  await context.setOffline(true);
  const first = await ask("In one word: what colour is a clear daytime sky?");
  check(
    "with no network at all, the device answers on its own",
    first.answer.length > 0 && !/stubbed OCADE answer/.test(first.answer),
    `${first.answer.slice(0, 120)} (${first.seconds.toFixed(1)} s)`,
  );
  check("and the answer is right", /blue/i.test(first.answer), first.answer.slice(0, 120));

  /* --- a cold start with the network still cut off ------------------------- */
  await page.reload({ waitUntil: "load" }).catch(() => undefined);
  await page.waitForSelector("#ocade-composer", { timeout: 60_000 }).catch(() => undefined);
  const cold = (await page.locator("#ocade-composer").count()) === 1;
  check("OCADE opens again with no network", cold);
  if (cold) {
    const second = await ask("Answer with a number only: what is 7 plus 5?");
    check(
      "and answers again from the stored model, without asking OCADE first",
      /\b12\b/.test(second.answer),
      `${second.answer.slice(0, 120)} (${second.seconds.toFixed(1)} s)`,
    );
  }
  await context.setOffline(false);
} catch (error) {
  check("the offline-real journey runs", false, String(error).slice(0, 400));
} finally {
  await browser.close();
}
process.stdout.write(
  failures ? `\n${failures} offline-real check(s) failed\n` : "\nall offline-real checks passed\n",
);
process.exit(failures ? 1 : 0);
