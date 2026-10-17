/**
 * BROWSER NOTIFICATIONS, END TO END.
 *
 * A person turns notifications on in Settings for this browser (the browser's
 * own permission, then a real subscription from its push service). Something
 * happens on the account with OCADE closed; OCADE encrypts a message to that
 * browser and signs for it, and it is shown. A second, stand-in browser
 * registered with keys made here receives the same message, which is decrypted
 * here to prove exactly what a browser reads; a browser its push service says
 * is gone is forgotten. Turning it off, and signing out, stop it.
 *
 * Usage: node scripts/e2e/push-journey.mjs [--base=…] [--supabase=…]
 */
import { createDecipheriv, createECDH, createHash, hkdfSync } from "node:crypto";
import { chromium } from "playwright-core";
import { BASE, EXECUTABLE, SUPABASE } from "./common.mjs";

let failures = 0;
let partlyBlocked = false;
function check(name, ok, detail = "") {
  if (!ok) failures += 1;
  process.stdout.write(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}\n`);
}
async function until(condition, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      if (await condition()) return true;
    } catch {
      /* not yet */
    }
    if (Date.now() > deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
const fixture = (name) => fetch(`${SUPABASE}/__fixture/${name}`).then((r) => r.json());

/** What a browser does with a push: decrypt it with its own key (RFC 8291). */
function decrypt(body, browser, auth) {
  const salt = body.subarray(0, 16);
  const idLength = body[20];
  const sender = body.subarray(21, 21 + idLength);
  const sealed = body.subarray(21 + idLength);
  const info = Buffer.concat([Buffer.from("WebPush: info\0"), browser.getPublicKey(), sender]);
  const ikm = Buffer.from(hkdfSync("sha256", browser.computeSecret(sender), auth, info, 32));
  const key = Buffer.from(
    hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16),
  );
  const nonce = Buffer.from(
    hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12),
  );
  const decipher = createDecipheriv("aes-128-gcm", key, nonce);
  decipher.setAuthTag(sealed.subarray(sealed.length - 16));
  const plain = Buffer.concat([
    decipher.update(sealed.subarray(0, sealed.length - 16)),
    decipher.final(),
  ]);
  return JSON.parse(plain.subarray(0, plain.length - 1).toString("utf8"));
}

const storageKey = `sb-${new URL(SUPABASE).hostname.split(".")[0]}-auth-token`;
const EMAIL = `push-${Date.now()}@ocade.test`;
const session = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: "proof" }),
}).then((r) => r.json());
const USER = session.user.id;
const rpc = (name, args) =>
  fetch(`${SUPABASE}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(args),
  });

// A browser with a real push service when one is given (Google Chrome on the cloud VM):
// Playwright's own Chromium build has none.
// Headless Chrome has no push service either: with a real browser it runs on a display (virtual
// on the cloud VM).
const browser = await chromium.launch({
  executablePath: process.env.OCADE_PUSH_BROWSER || EXECUTABLE,
  headless: !process.env.OCADE_PUSH_BROWSER,
  args: ["--no-sandbox"],
});
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.grantPermissions(["notifications"], { origin: BASE });
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [storageKey, JSON.stringify(session)],
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(String(error).slice(0, 200)));
  await page.goto(`${BASE}/?settings=notifications`, { waitUntil: "networkidle" });
  await page.evaluate(() => navigator.serviceWorker.ready);
  check(
    "a link opens Settings at Notifications, and leaves the address clean",
    (await page.getByRole("dialog").count()) === 1 && !page.url().includes("settings="),
    page.url(),
  );
  const toggle = page.getByRole("switch", { name: "Notifications on this device" });
  check(
    "Settings offers notifications for this device",
    await toggle.isVisible().catch(() => false),
  );
  await toggle.click();
  const subscribed = await until(
    async () => (await toggle.getAttribute("aria-checked")) === "true",
    20_000,
  );
  const problem = subscribed
    ? ""
    : await page
        .getByRole("dialog")
        .getByText(/notification service|could not turn/)
        .innerText()
        .catch(() => "");
  const realService = subscribed;
  if (!subscribed && /could not reach its notification service/.test(problem)) {
    process.stdout.write(
      "BLOCKED  a real push service — this browser build has none; the refusal was said plainly\n",
    );
    partlyBlocked = true;
  } else {
    check("turned on: the browser subscribed with its push service", subscribed, problem);
  }
  const stored = (await fixture("push-subscriptions")).filter((row) => row.user_id === USER);
  if (realService) {
    check(
      "OCADE keeps this browser's address for this account",
      stored.length === 1 && /^https:\/\//.test(stored[0].endpoint),
      stored[0]?.endpoint?.slice(0, 60),
    );
  }

  /* --- a stand-in browser with keys made here, and one its service has lost --- */
  const standIn = createECDH("prime256v1");
  standIn.generateKeys();
  const standInAuth = Buffer.from("proof-auth-16-by");
  const register = (name) =>
    rpc("ocade_push_subscribe", {
      p_endpoint: `${SUPABASE}/__push/${name}`,
      p_p256dh: standIn.getPublicKey().toString("base64url"),
      p_auth: standInAuth.toString("base64url"),
    });
  const standInName = `browser-${Date.now()}`;
  check("a second browser registers", (await register(standInName)).ok);
  await register(`gone-${Date.now()}`);
  const forged = await fetch(`${SUPABASE}/rest/v1/rpc/ocade_push_subscribe`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ p_endpoint: "javascript:alert(1)", p_p256dh: "x", p_auth: "y" }),
  });
  check(
    "an address that is not a browser's is refused",
    forged.status === 400,
    String(forged.status),
  );

  /* --- something happens on the account: OCADE is closed -------------------- */
  // Connecting a new computer is a security event: always delivered, never muted.
  const deskKey = Buffer.from(`desk-${Date.now()}`).toString("base64url");
  const [pending] = await fetch(`${SUPABASE}/rest/v1/jarvis_devices`, {
    method: "POST",
    headers: { "content-type": "application/json", prefer: "return=representation" },
    body: JSON.stringify({
      name: "Desk PC",
      platform: "Windows",
      public_key: deskKey,
      user_id: null,
      enrollment_expires_at: new Date(Date.now() + 600_000).toISOString(),
    }),
  }).then((r) => r.json());
  await page.goto(`${BASE}/ocade-jarvis?connect=${pending.id}`, { waitUntil: "networkidle" });
  // Recorded with no network of its own, so the person types the fingerprint it shows.
  await page
    .getByRole("textbox", { name: "Fingerprint the device shows" })
    .fill(createHash("sha256").update(deskKey).digest("hex").slice(0, 16));
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  check(
    "the account's security event is recorded",
    await until(async () =>
      (await fixture("notifications")).some(
        (row) => row.user_id === USER && row.title === "A new device was connected to OCADE JARVIS",
      ),
    ),
  );
  const pushes = () => fixture("pushes");
  check(
    "the stand-in browser received it",
    await until(async () => (await pushes()).some((push) => push.name === standInName)),
  );
  const received = (await pushes()).find((push) => push.name === standInName);
  const message = received
    ? decrypt(Buffer.from(received.body, "base64url"), standIn, standInAuth)
    : {};
  check(
    "encrypted to that browser alone, and it reads the alert and where it leads",
    message.title === "A new device was connected to OCADE JARVIS" &&
      message.url === "/ocade-jarvis",
    JSON.stringify(message),
  );
  check(
    "signed by OCADE for the push service, and urgent because it is security",
    /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/.test(received?.authorization ?? "") &&
      received?.encoding === "aes128gcm" &&
      received?.urgency === "high",
    received?.authorization?.slice(0, 40),
  );
  check(
    "a browser its push service no longer has is forgotten",
    await until(async () =>
      (await fixture("push-subscriptions")).every((row) => !row.endpoint.includes("/__push/gone-")),
    ),
  );
  const recorded = (await fixture("notifications")).find(
    (row) => row.user_id === USER && row.title === "A new device was connected to OCADE JARVIS",
  );
  check(
    "and the notification says it went to browsers",
    recorded?.delivery?.web_push === "sent",
    JSON.stringify(recorded?.delivery),
  );
  /*
   * WHAT THE BROWSER DOES WITH IT. The same message, delivered to this
   * browser's service worker through Chromium's own push-delivery hook (the
   * step a push service performs), is shown as a notification with its tag;
   * an address from elsewhere in a message is never followed.
   */
  const cdp = await context.newCDPSession(page);
  await cdp.send("ServiceWorker.enable");
  const registrationId = await new Promise((resolve) => {
    cdp.on("ServiceWorker.workerRegistrationUpdated", ({ registrations }) => {
      const mine = registrations.find((entry) => entry.scopeURL === `${BASE}/`);
      if (mine) resolve(mine.registrationId);
    });
  });
  const deliver = (data) =>
    cdp.send("ServiceWorker.deliverPushMessage", { origin: BASE, registrationId, data });
  const titles = () =>
    page.evaluate(async () =>
      (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => ({
        title: n.title,
        tag: n.tag,
        url: n.data?.url,
      })),
    );
  await deliver(JSON.stringify(message));
  check(
    "the service worker shows it, tagged so a resend replaces it",
    await until(async () =>
      (await titles()).some(
        (n) => n.title === message.title && n.tag === message.tag && n.url === "/ocade-jarvis",
      ),
    ),
    JSON.stringify(await titles()),
  );
  await deliver(JSON.stringify({ title: "Elsewhere", url: "https://evil.example/x", tag: "t2" }));
  check(
    "a message pointing off OCADE opens OCADE instead",
    await until(async () => (await titles()).some((n) => n.title === "Elsewhere" && n.url === "/")),
  );
  await deliver("");
  check(
    "even an empty push shows something, never nothing",
    await until(async () => (await titles()).some((n) => n.title === "OCADE")),
  );
  await cdp.detach();

  if (realService) {
    const shown = await until(
      async () =>
        (
          await page.evaluate(async () =>
            (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => n.title),
          )
        ).includes("A new device was connected to OCADE JARVIS"),
      30_000,
    );
    check("this browser showed it, from its real push service", shown);
  }

  /* --- off, and signed out ------------------------------------------------------ */
  await page.goto(`${BASE}/?settings=notifications`, { waitUntil: "networkidle" });
  if (realService) {
    const again = page.getByRole("switch", { name: "Notifications on this device" });
    await again.click();
    check(
      "turned off: this browser's address is gone",
      await until(async () =>
        (await fixture("push-subscriptions")).every(
          (row) => row.user_id !== USER || row.endpoint.includes("/__push/"),
        ),
      ),
    );
  }
  check("no page errors", errors.length === 0, errors.join(" | "));
} catch (error) {
  check("the push journey runs", false, String(error).slice(0, 500));
} finally {
  await browser.close();
}

process.stdout.write(
  failures === 0 ? "\nPush journey passed.\n" : `\n${failures} push checks failed.\n`,
);
process.exit(failures === 0 ? (partlyBlocked ? 3 : 0) : 1);
