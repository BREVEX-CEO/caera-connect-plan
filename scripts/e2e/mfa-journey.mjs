/**
 * Two-step verification, proved in a real browser against RFC 6238 codes.
 *
 * The loopback stub computes TOTP exactly as an authenticator app does (and as
 * Supabase Auth checks it: SHA-1, six digits, 30-second steps, one step of
 * drift, no reuse). This journey reads the key off the screen the way a person
 * would type it into their app, computes the code, and drives every state:
 * setup, QR, wrong code, a key left over from an earlier try, cancel, success,
 * the sign-in challenge with a replayed code, a second account, and turning it off.
 *
 * Usage: node scripts/e2e/mfa-journey.mjs [--base=…] [--supabase=…]
 */
import { createHmac } from "node:crypto";
import { chromium } from "playwright-core";

const arg = (name, fallback) => {
  const found = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};

const BASE = arg("base", "http://127.0.0.1:8788");
const SUPABASE = arg("supabase", "http://127.0.0.1:54321");
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM || undefined;

let failures = 0;
function check(name, ok, detail = "") {
  if (!ok) failures += 1;
  process.stdout.write(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}\n`);
}

function totp(secret, offset = 0) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret.replace(/\s/g, "").toUpperCase()) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  }
  const key = Buffer.from(bits.match(/.{8}/g).map((byte) => parseInt(byte, 2)));
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000) + offset));
  const mac = createHmac("sha1", key).update(message).digest();
  const at = mac[mac.length - 1] & 0xf;
  return String((mac.readUInt32BE(at) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

const wrongCode = (secret) =>
  ["000000", "111111", "222222"].find(
    (code) => ![-1, 0, 1].some((offset) => totp(secret, offset) === code),
  );

const storageKey = (url) => `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
const stamp = Date.now();
const EMAIL_A = `mfa-a-${stamp}@ocade.test`;
const EMAIL_B = `mfa-b-${stamp}@ocade.test`;

const signIn = (email) =>
  fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "proof" }),
  }).then((response) => response.json());

const factorsOf = (token) =>
  fetch(`${SUPABASE}/auth/v1/user`, { headers: { authorization: `Bearer ${token}` } })
    .then((response) => response.json())
    .then((user) => user.factors ?? []);

const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });

async function contextFor(session) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await context.addInitScript(
    ([key, value]) => {
      try {
        // Only the first load: a session the app upgraded (aal2) must not be replaced.
        if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, value);
      } catch {
        /* A failed write shows up as a signed-out shell. */
      }
    },
    [storageKey(SUPABASE), JSON.stringify(session)],
  );
  return context;
}

async function openAccount(page) {
  await page.click('aside button[aria-haspopup="menu"]');
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Account", exact: true }).click();
}

const dialogText = (page) => page.getByRole("dialog", { name: "Settings" }).innerText();
const readKey = async (page) => (await page.getByLabel("Setup key").innerText()).replace(/\s/g, "");

try {
  const sessionA = await signIn(EMAIL_A);
  const context = await contextFor(sessionA);
  const page = await context.newPage();
  const console = [];
  page.on("console", (message) => console.push(message.text()));
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await openAccount(page);

  check("two-step starts Off", (await dialogText(page)).includes("Off. Add an authenticator app"));

  /* --- cancel leaves nothing behind ----------------------------------------- */
  await page.getByRole("button", { name: "Set up", exact: true }).click();
  await page.getByLabel("Setup key").waitFor();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.waitForTimeout(500);
  check(
    "Cancel removes the unfinished factor",
    (await factorsOf(sessionA.access_token)).length === 0,
  );

  /* --- setup screen ---------------------------------------------------------- */
  await page.getByRole("button", { name: "Set up", exact: true }).click();
  await page.getByLabel("Setup key").waitFor();
  const qr = page.getByRole("img", { name: "QR code for your authenticator app" });
  check(
    "a QR code is shown to scan",
    (await qr.count()) === 1 && (await qr.getAttribute("src")).startsWith("data:image/svg+xml"),
  );
  const firstKey = await readKey(page);
  check("the key is shown for typing by hand", /^[A-Z2-7]{32}$/.test(firstKey), firstKey.length);
  check(
    "the key is grouped for reading",
    (await page.getByLabel("Setup key").innerText()).split(" ").length === 8,
  );
  const input = page.getByLabel("Six-digit code from your authenticator app");
  await input.fill("12ab 3-4");
  check("the code box keeps digits only", (await input.inputValue()) === "1234");
  // Authenticator apps show and copy "123 456": a pasted code must survive its space.
  await input.fill("");
  await input.focus();
  await page.keyboard.insertText("123 456");
  check("a pasted code with a space keeps all six digits", (await input.inputValue()) === "123456");
  await input.fill("");
  check(
    "Confirm waits for six digits",
    await page.getByRole("button", { name: "Confirm", exact: true }).isDisabled(),
  );

  /* --- a wrong code, twice ---------------------------------------------------- */
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await input.fill(wrongCode(firstKey));
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await page.getByRole("alert").waitFor();
  }
  check(
    "a wrong code is refused in plain words",
    (await page.getByRole("alert").innerText()).includes("That code was not accepted"),
  );
  check("the box is cleared for the next code", (await input.inputValue()) === "");
  check(
    "after two refusals it offers a fresh key",
    (await page.getByRole("button", { name: "Start again with a new key" }).count()) === 1,
  );

  /* --- a key left over from an earlier try ------------------------------------ */
  await page.getByRole("button", { name: "Start again with a new key" }).click();
  await page.waitForFunction(
    (old) =>
      document.querySelector('[aria-label="Setup key"]')?.textContent.replace(/\s/g, "") !== old,
    firstKey,
  );
  const secondKey = await readKey(page);
  check("starting again makes a new key", secondKey !== firstKey);
  check(
    "and only one unfinished factor exists",
    (await factorsOf(sessionA.access_token)).length === 1,
  );
  await input.fill(totp(firstKey));
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("alert").waitFor();
  check(
    "a code from the old key is refused",
    (await page.getByRole("alert").innerText()).includes("not accepted"),
  );

  /* --- a fresh code from the current key -------------------------------------- */
  const enrolledWith = totp(secondKey);
  await input.fill(enrolledWith);
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByText("On. OCADE asks for a code").waitFor({ timeout: 10_000 });
  check("a fresh code turns two-step On", true);

  /* --- recovery codes are made with it, and shown once -------------------------- */
  const sheet = page.getByRole("region", { name: "Your recovery codes" });
  await sheet.waitFor({ timeout: 10_000 });
  const firstSheet = await sheet.locator("li").allInnerTexts();
  check(
    "turning two-step on hands over ten recovery codes",
    firstSheet.length === 10 &&
      firstSheet.every((code) => /^[0-9A-Z]{5}(-[0-9A-Z]{5}){3}$/.test(code)) &&
      new Set(firstSheet).size === 10,
    firstSheet[0],
  );
  await sheet.getByRole("button", { name: "I saved them" }).click();
  check(
    "then only how many are left is shown, never the codes",
    (await page.getByText("10 left. Each works once").count()) === 1 &&
      !(await dialogText(page)).includes(firstSheet[0]),
  );
  check(
    "the codes never reach the console or storage",
    !console.some((line) => line.includes(firstSheet[0])) &&
      !(await page.evaluate(() => JSON.stringify({ ...window.localStorage }))).includes(
        firstSheet[0],
      ),
  );
  const verified = (await factorsOf(sessionA.access_token)).filter((f) => f.status === "verified");
  check("exactly one verified factor on the account", verified.length === 1);
  const stored = await page.evaluate(
    (key) => window.localStorage.getItem(key),
    storageKey(SUPABASE),
  );
  const payload = JSON.parse(
    Buffer.from(JSON.parse(stored).access_token.split(".")[1], "base64url").toString(),
  );
  check("this session is now aal2", payload.aal === "aal2", payload.aal);
  check(
    "the key never reaches the console or storage",
    !console.some((line) => line.includes(secondKey)) &&
      !(await page.evaluate(() => JSON.stringify({ ...window.localStorage }))).includes(secondKey),
  );
  await context.close();

  /* --- signing in again asks for the code -------------------------------------- */
  const fresh = await signIn(EMAIL_A);
  const again = await contextFor(fresh);
  const challenge = await again.newPage();
  await challenge.goto(`${BASE}/library`, { waitUntil: "networkidle" });
  await challenge.waitForURL(/\/auth\/challenge/, { timeout: 10_000 });
  check("a new sign-in is sent to the code screen", challenge.url().includes("/auth/challenge"));
  const box = challenge.getByLabel("Six-digit code from your authenticator app");
  await box.fill(wrongCode(secondKey));
  await challenge.getByRole("button", { name: /Confirm|Continue|Verify/ }).click();
  await challenge.getByRole("alert").waitFor();
  check("a wrong sign-in code is refused", (await challenge.getByRole("alert").count()) === 1);
  await box.fill(enrolledWith);
  await challenge.getByRole("button", { name: /Confirm|Continue|Verify/ }).click();
  await challenge.waitForTimeout(1500);
  check("a replayed code is refused", challenge.url().includes("/auth/challenge"));
  await box.fill(totp(secondKey, 1));
  await challenge.getByRole("button", { name: /Confirm|Continue|Verify/ }).click();
  await challenge.waitForURL(/\/library/, { timeout: 10_000 });
  check("the next code signs in and returns to the page asked for", true);

  /* --- another account is untouched ------------------------------------------- */
  const sessionB = await signIn(EMAIL_B);
  const contextB = await contextFor(sessionB);
  const pageB = await contextB.newPage();
  await pageB.goto(`${BASE}/`, { waitUntil: "networkidle" });
  check("account B is not asked for A's code", !pageB.url().includes("/auth/challenge"));
  await openAccount(pageB);
  check("account B shows its own state (Off)", (await dialogText(pageB)).includes("Off."));
  await contextB.close();

  /* --- turning it off needs the assured session -------------------------------- */
  await challenge.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await openAccount(challenge);
  await challenge.getByRole("button", { name: "Turn off", exact: true }).click();
  // Turning protection off is confirmed explicitly, never one click.
  await challenge.getByRole("button", { name: "Turn off two-step", exact: true }).click();
  await challenge
    .getByText("Off. Add an authenticator app")
    .waitFor({ timeout: 10_000 })
    .catch(async (error) => {
      await challenge.screenshot({ path: process.env.TEMP + "/mfa-turnoff.png" });
      throw new Error(
        `${String(error).split(String.fromCharCode(10))[0]} | screen: ${(await dialogText(challenge)).slice(0, 400)}`,
      );
    });
  check("Turn off works from an aal2 session", true);
  await again.close();
  /* --- an old proof: "Confirm it's you", then the action completes ------------ */
  const staleEmail = `mfa-c-${stamp}@ocade.test`;
  const stale = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: staleEmail, password: "stale-proof" }),
  }).then((response) => response.json());
  const contextC = await contextFor(stale);
  const pageC = await contextC.newPage();
  await pageC.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await pageC.click('aside button[aria-haspopup="menu"]');
  await pageC.getByRole("menuitem", { name: "Settings" }).click();
  await pageC.getByRole("button", { name: "Privacy & Security", exact: true }).click();
  const downloaded = pageC.waitForEvent("download", { timeout: 20_000 });
  await pageC.getByRole("button", { name: "Export", exact: true }).click();
  const ask = pageC.getByRole("dialog", { name: "Confirm it's you" });
  await ask.waitFor({ timeout: 10_000 });
  // The dialog opens on "One moment…" while the code is sent; wait for what it then says.
  await ask
    .getByText(staleEmail)
    .waitFor({ timeout: 10_000 })
    .catch(() => undefined);
  check(
    "an hour-old proof asks to confirm it's you",
    (await ask.innerText()).includes(staleEmail),
    (await ask.innerText()).replace(/\s+/g, " ").slice(0, 200),
  );
  await ask.getByLabel("Verification code").fill("000000");
  await ask.getByRole("button", { name: "Confirm", exact: true }).click();
  await ask.getByRole("alert").waitFor({ timeout: 10_000 });
  check("a wrong emailed code is refused", true);
  await ask.getByLabel("Verification code").fill("123456");
  await ask.getByRole("button", { name: "Confirm", exact: true }).click();
  const file = await downloaded;
  check("then the export completes", file.suggestedFilename().startsWith("ocade-account-export-"));
  await contextC.close();

  /* --- a lost phone: a recovery code turns two-step off, and signs nobody in ----- */
  const EMAIL_D = `mfa-d-${stamp}@ocade.test`;
  const contextD = await contextFor(await signIn(EMAIL_D));
  const pageD = await contextD.newPage();
  await pageD.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await openAccount(pageD);
  await pageD.getByRole("button", { name: "Set up", exact: true }).click();
  await pageD.getByLabel("Setup key").waitFor();
  const keyD = await readKey(pageD);
  await pageD.getByLabel("Six-digit code from your authenticator app").fill(totp(keyD));
  await pageD.getByRole("button", { name: "Confirm", exact: true }).click();
  const sheetD = pageD.getByRole("region", { name: "Your recovery codes" });
  await sheetD.waitFor({ timeout: 10_000 });
  const codes = await sheetD.locator("li").allInnerTexts();
  await sheetD.getByRole("button", { name: "I saved them" }).click();

  // Making a new sheet retires the old one. The first sheet spent this sign-in's
  // confirmation (one confirmation, one change), so the authenticator is asked again.
  await pageD.getByRole("button", { name: "Make new codes", exact: true }).click();
  const askD = pageD.getByRole("dialog", { name: "Confirm it's you" });
  check(
    "a second change asks for the authenticator code again",
    await askD.waitFor({ timeout: 10_000 }).then(
      () => true,
      () => false,
    ),
  );
  await askD.getByLabel("Verification code").fill(totp(keyD, 1)); // the setup used this window's code
  await askD.getByRole("button", { name: "Confirm", exact: true }).click();
  await sheetD.waitFor({ timeout: 10_000 });
  const newCodes = await sheetD.locator("li").allInnerTexts();
  check(
    "a new sheet is ten different codes",
    newCodes.length === 10 && !newCodes.some((code) => codes.includes(code)),
  );
  await contextD.close();

  // The phone is gone. A new sign-in stops at the code screen.
  const lost = await contextFor(await signIn(EMAIL_D));
  const pageLost = await lost.newPage();
  await pageLost.goto(`${BASE}/library`, { waitUntil: "networkidle" });
  await pageLost.waitForURL(/\/auth\/challenge/, { timeout: 10_000 });
  await pageLost.getByRole("button", { name: "I lost my authenticator" }).click();
  const recoveryBox = pageLost.getByLabel("Recovery code");
  const useCode = pageLost.getByRole("button", { name: "Use this code" });
  check("a recovery code is asked for, and the button waits for one", await useCode.isDisabled());
  await recoveryBox.fill(codes[0]);
  await useCode.click();
  await pageLost.getByRole("alert").waitFor({ timeout: 10_000 });
  check(
    "a code from the replaced sheet no longer works",
    (await pageLost.getByRole("alert").innerText()).includes("not accepted"),
  );
  // Typed the way people type it back: lower case, spaces for hyphens.
  await recoveryBox.fill(newCodes[4].toLowerCase().replaceAll("-", " "));
  await useCode.click();
  await pageLost.getByRole("heading", { name: "Two-step verification is off" }).waitFor({
    timeout: 15_000,
  });
  check("a current code turns two-step off", true);
  check(
    "and removes the authenticator from the account",
    (await factorsOf((await signIn(EMAIL_D)).access_token)).length === 0,
  );
  check(
    "without signing anybody in",
    (await pageLost.evaluate((key) => window.localStorage.getItem(key), storageKey(SUPABASE))) ===
      null,
  );
  check(
    "the way back is an ordinary sign-in",
    (await pageLost.getByRole("button", { name: "Go to sign in" }).count()) === 1,
  );
  await lost.close();

  // Signed in again: no code screen, and the account can set two-step up anew.
  const back = await contextFor(await signIn(EMAIL_D));
  const pageBack = await back.newPage();
  await pageBack.goto(`${BASE}/`, { waitUntil: "networkidle" });
  check("the next sign-in is not stopped for a code", !pageBack.url().includes("/auth/challenge"));
  await openAccount(pageBack);
  check(
    "and two-step reads Off, ready to be set up on the new phone",
    (await dialogText(pageBack)).includes("Off. Add an authenticator app"),
  );
  await back.close();
} catch (error) {
  check("journey completed", false, String(error).split("\n")[0]);
} finally {
  await browser.close();
}

process.stdout.write(`\n${failures === 0 ? "MFA journey passed" : `${failures} failed`}\n`);
process.exit(failures === 0 ? 0 : 1);
