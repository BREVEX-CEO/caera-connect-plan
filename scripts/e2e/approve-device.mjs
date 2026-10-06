/**
 * Approve the newest waiting device as a signed-in local account, the way a
 * person does it in OCADE (used by the real-Windows install proof).
 *
 * Usage: node scripts/e2e/approve-device.mjs [email]
 */
import { chromium } from "playwright-core";

const BASE = "http://127.0.0.1:8788";
const SUPABASE = "http://127.0.0.1:54321";
const EMAIL = process.argv[2] ?? "owner-install@ocade.test";

const pending = await fetch(
  `${SUPABASE}/rest/v1/jarvis_devices?user_id=is.null&select=id,name`,
).then((r) => r.json());
const device = pending.at(-1);
if (!device) {
  console.log("no waiting device");
  process.exit(1);
}
const session = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: "proof" }),
}).then((r) => r.json());
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || chromium.executablePath(),
});
try {
  const context = await browser.newContext();
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    ["sb-127-auth-token", JSON.stringify(session)],
  );
  const page = await context.newPage();
  await page.goto(`${BASE}/ocade-jarvis?connect=${device.id}`, { waitUntil: "networkidle" });
  const fingerprint = await page.getByTestId("device-fingerprint").innerText();
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  // Approved means the device now belongs to the account, not that a click happened (F-128).
  const deadline = Date.now() + 15_000;
  let owner = null;
  while (Date.now() < deadline && !owner) {
    const [row] = await fetch(
      `${SUPABASE}/rest/v1/jarvis_devices?id=eq.${device.id}&select=user_id`,
    ).then((r) => r.json());
    owner = row?.user_id ?? null;
    if (!owner) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (owner !== session.user.id) {
    console.log(JSON.stringify({ approved: false, device: device.id, owner }));
    process.exitCode = 1;
  } else {
    console.log(
      JSON.stringify({
        approved: device.id,
        name: device.name,
        fingerprint,
        user: session.user.id,
      }),
    );
  }
} finally {
  await browser.close();
}
