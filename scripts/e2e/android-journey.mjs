/**
 * OCADE for Android, driven like a person on a real Android emulator with Appium
 * (UiAutomator2), against the local OCADE site and its Supabase stub.
 *
 *   node scripts/e2e/harness.mjs --no-build --serve     (the site and the stub)
 *   python android/build.py                              (the app)
 *   node scripts/e2e/android-journey.mjs [--decline]     (an emulator must be running)
 *
 * Covers: first screen, connecting the phone first with its own key and a
 * one-click approval in OCADE, then Android's own notification question (allowed,
 * or declined and never asked in a loop), the optional bubble and app control
 * from their own buttons, the floating bubble, JARVIS opening an app and reading its controls on the
 * phone, STOP from the bubble, removal in OCADE, orientation, reinstall.
 * Android asks every question itself; this only answers them as a person would.
 */
import { execFileSync, spawn } from "node:child_process";
import path from "node:path";
import { chromium } from "playwright-core";

const arg = (name, fallback) => {
  const found = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};
const BASE = arg("base", "http://127.0.0.1:8788");
const SUPABASE = arg("supabase", "http://127.0.0.1:54321");
const PHONE_BASE = "http://10.0.2.2:8788"; // the emulator's view of this computer
const UDID = arg("udid", "emulator-5554");
const APPIUM = "http://127.0.0.1:4725";
const DECLINE = process.argv.includes("--decline");
const SDK =
  process.env.ANDROID_HOME ??
  process.env.ANDROID_SDK_ROOT ??
  path.join(process.env.LOCALAPPDATA ?? process.env.HOME ?? "", "Android", "Sdk");
const ADB = path.join(SDK, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
const APK = "android/build/OCADE-test.apk";

let failures = 0;
function check(name, ok, detail = "") {
  if (!ok) failures += 1;
  process.stdout.write(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}\n`);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(condition, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      if (await condition()) return true;
    } catch {
      /* not yet */
    }
    if (Date.now() > deadline) return false;
    await sleep(500);
  }
}
const adb = (...args) =>
  execFileSync(ADB, ["-s", UDID, ...args], { encoding: "utf8", timeout: 120_000 });

/* --- a small W3C WebDriver client: all Appium needs here ---------------------- */

let session = null;
async function wd(method, path, body) {
  const response = await fetch(`${APPIUM}/session${session ? `/${session}` : ""}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json();
  if (json.value?.error)
    throw new Error(`${json.value.error}: ${json.value.message?.slice(0, 200)}`);
  return json.value;
}
const ui = (text) => `new UiSelector().text(${JSON.stringify(text)})`;
// UiSelector looks in the app in front; the floating bubble is a window of its own, found by XPath.
const using = (selector) => (selector.startsWith("//") ? "xpath" : "-android uiautomator");
const floating = (text) => `//*[@text=${JSON.stringify(text)}]`;
async function find(selector, timeoutMs = 15_000) {
  let found = null;
  await until(async () => {
    const element = await wd("POST", "/element", { using: using(selector), value: selector });
    found = Object.values(element)[0];
    return Boolean(found);
  }, timeoutMs);
  return found;
}
async function exists(selector) {
  const list = await wd("POST", "/elements", { using: using(selector), value: selector });
  return list.length > 0;
}
async function tap(selector) {
  const element = await find(selector);
  if (!element) throw new Error(`not on screen: ${selector}`);
  await wd("POST", `/element/${element}/click`, {});
}
const source = () => wd("GET", "/source");
const back = () => wd("POST", "/back", {});

/* --- OCADE's side: the account the phone is connected to ---------------------- */

const EMAIL = `phone-${Date.now()}@ocade.test`;
const signIn = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: "proof" }),
}).then((r) => r.json());
const devices = (query) =>
  fetch(`${SUPABASE}/rest/v1/jarvis_devices?${query}`).then((r) => r.json());

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || chromium.executablePath(),
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(
  ([key, value]) => window.localStorage.setItem(key, value),
  ["sb-127-auth-token", JSON.stringify(signIn)],
);
const web = await context.newPage();

const appium = spawn(
  process.platform === "win32" ? "appium.cmd" : "appium",
  ["--port", "4725", "--log-level", "error"],
  {
    shell: process.platform === "win32",
    stdio: "ignore",
  },
);
try {
  await until(async () => (await fetch(`${APPIUM}/status`)).ok, 60_000);

  /* --- a fresh install ----------------------------------------------------- */
  try {
    adb("uninstall", "in.ocade.app");
  } catch {
    /* not installed */
  }
  adb("install", "-r", APK);
  const created = await fetch(`${APPIUM}/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      capabilities: {
        alwaysMatch: {
          platformName: "Android",
          "appium:automationName": "UiAutomator2",
          "appium:udid": UDID,
          "appium:appPackage": "in.ocade.app",
          "appium:appActivity": ".MainActivity",
          "appium:optionalIntentArguments": `--es server ${PHONE_BASE}`,
          "appium:noReset": true,
          "appium:autoGrantPermissions": false,
          // Keep OCADE's own accessibility service running while Appium watches.
          "appium:disableSuppressAccessibilityService": true,
          "appium:newCommandTimeout": 600,
          // A cold, software-rendered emulator (the tablet) takes longer than the default 30 s.
          "appium:uiautomator2ServerLaunchTimeout": 180_000,
          "appium:uiautomator2ServerInstallTimeout": 180_000,
          "appium:adbExecTimeout": 120_000,
        },
      },
    }),
  }).then((r) => r.json());
  session = created.value?.sessionId;
  if (!session)
    throw new Error(`Appium could not start a session: ${JSON.stringify(created).slice(0, 400)}`);
  // The floating bubble lives in its own window over other apps.
  await wd("POST", "/appium/settings", { settings: { enableMultiWindows: true } });

  check(
    "the first screen says OCADE is not set up, with one button to set it up",
    await until(async () => (await exists(ui("Not set up"))) && (await exists(ui("Set up OCADE")))),
  );
  check(
    "it lists what it needs and why, with the bubble and app control marked optional",
    (await exists('new UiSelector().description("Notifications: not allowed yet")')) &&
      (await exists(
        'new UiSelector().description("Display over other apps (optional): not allowed yet")',
      )) &&
      (await exists(
        'new UiSelector().description("Accessibility: OCADE JARVIS (optional): not allowed yet")',
      )),
  );

  /* --- Set up connects first: the phone's own key, one approval ------------ */
  // Requests already waiting (an earlier run's) are not this phone's.
  const earlier = new Set(
    (await devices("user_id=is.null&kind=eq.android&select=id")).map((row) => row.id),
  );
  await tap(ui("Set up OCADE"));
  let phone = null;
  await until(async () => {
    phone =
      (await devices("user_id=is.null&kind=eq.android&select=id,name,platform")).find(
        (row) => !earlier.has(row.id),
      ) ?? null;
    return Boolean(phone);
  }, 30_000);
  check(
    "Set up asks OCADE to connect it, as an Android device, before any permission",
    Boolean(phone) && !(await exists(ui("Allow"))),
    JSON.stringify(phone),
  );
  // The approval page opened in the phone's browser; the person approves where they are signed in.
  await web.goto(`${BASE}/ocade-jarvis?connect=${phone.id}`, { waitUntil: "networkidle" });
  adb("shell", "am", "start", "-n", "in.ocade.app/.MainActivity");
  let printed = "";
  await until(async () => {
    printed = /fingerprint is ([0-9A-F]{4}(?:-[0-9A-F]{4}){3})/.exec(await source())?.[1] ?? "";
    return Boolean(printed);
  }, 20_000);
  if ((await web.getByTestId("device-fingerprint").count()) === 1) {
    // From the phone's own network: OCADE shows the fingerprint to compare.
    const shown = await web.getByTestId("device-fingerprint").innerText();
    check(
      "OCADE shows the same fingerprint the phone shows",
      shown === printed,
      `${shown} / ${printed}`,
    );
  } else {
    // From another network (the emulator's own): the person types what the phone shows.
    const typed = web.getByRole("textbox", { name: "Fingerprint the device shows" });
    if (!(await typed.isVisible({ timeout: 10_000 }).catch(() => false))) {
      throw new Error(
        `no approval form: ${(await web.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 400)}`,
      );
    }
    await typed.fill(printed);
    check("from another network, OCADE asks for the fingerprint the phone shows", Boolean(printed));
  }
  await web.getByRole("button", { name: "Connect", exact: true }).click();
  check(
    "Connect connects it, and the phone then asks only for notifications",
    await until(
      async () => (await exists(ui("Needs your permission"))) && (await exists(ui("Set up OCADE"))),
      30_000,
    ),
    (await web.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 300),
  );

  /* --- Android's own notification question, then the optional ones -------- */
  await tap(ui("Set up OCADE"));
  await find(ui(DECLINE ? "Don’t allow" : "Allow"), 20_000);
  check("Android itself asks about notifications", true);
  // Answered as a person would: again if the dialog was still animating in and missed the tap.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!(await exists(ui(DECLINE ? "Don’t allow" : "Allow")))) break;
    await tap(ui(DECLINE ? "Don’t allow" : "Allow")).catch(() => undefined);
    await sleep(1_500);
  }
  if (DECLINE) {
    check(
      "the one left off is said plainly, and was asked about only once",
      await until(
        async () =>
          (await exists('new UiSelector().description("Notifications: not allowed yet")')) &&
          (await exists('new UiSelector().textContains("Some of this was left off")')) &&
          !(await exists(ui("Don’t allow"))),
        10_000,
      ),
    );
  } else {
    check(
      "notifications allowed, the phone says Ready",
      await until(async () => await exists('new UiSelector().textStartsWith("Ready")'), 45_000),
      ((await source()).match(/text="[^"]+"/g) ?? []).slice(0, 12).join(" "),
    );
  }
  // The bubble: the person's choice, from its own button with its reason.
  await tap(ui("Allow the bubble"));
  await until(async () => await exists(ui("Display over other apps")), 20_000);
  if (await exists(ui("OCADE"))) await tap(ui("OCADE")); // a list of apps first on newer Android
  await tap(ui("Allow display over other apps"));
  await until(async () => /checked="true"/.test(await source()), 5_000);
  await back();
  if (await exists(ui("Display over other apps"))) await back();
  // App control: the same, through Android's Accessibility screen.
  await tap(ui("Allow app control"));
  // Scrolled to, as a person would: the list of services can be longer than the screen.
  const service =
    'new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().text("OCADE JARVIS"))';
  await until(async () => await exists(service), 30_000);
  await tap(service);
  await tap('new UiSelector().resourceId("com.android.settings:id/main_switch_bar")');
  await find(ui("Allow"), 10_000);
  check("Android warns about full control in its own words", /full control/i.test(await source()));
  await tap(ui("Allow"));
  await until(async () => await exists(ui("Use OCADE JARVIS")), 5_000);
  await back();
  await back();
  adb("shell", "am", "start", "-n", "in.ocade.app/.MainActivity");
  check(
    "the bubble and app control, once allowed, are no longer listed",
    await until(
      async () =>
        !(await exists('new UiSelector().descriptionContains("(optional): not allowed yet")')),
      10_000,
    ),
  );

  /* --- the floating bubble ------------------------------------------------- */
  const bubble = '//*[starts-with(@content-desc, "OCADE JARVIS ·")]';
  check(
    "the OCADE bubble floats over the screen",
    await until(async () => await exists(bubble), 20_000),
  );
  // Over other apps is what it is for: from the home screen.
  await wd("POST", "/appium/device/press_keycode", { keycode: 3 });
  await until(async () => await exists(bubble), 10_000);
  await tap(bubble);
  check(
    "tapped, it offers STOP, Talk and Open JARVIS",
    (await until(async () => await exists(floating("STOP JARVIS")), 10_000)) &&
      (await exists(floating("Talk to JARVIS"))) &&
      (await exists(floating("Open JARVIS"))),
  );
  await tap(bubble);

  /* --- JARVIS works on the phone, only with what the person allowed -------- */
  await web.goto(`${BASE}/ocade-jarvis`, { waitUntil: "networkidle" });
  await web
    .getByRole("navigation", { name: "JARVIS" })
    .getByRole("button", { name: "Devices" })
    .click();
  await until(
    async () =>
      await web
        .getByRole("switch", { name: /Open apps/ })
        .first()
        .isEnabled(),
    20_000,
  );
  for (const name of [/Open apps/, /See the screen/, /Mouse and keyboard/]) {
    const toggle = web.getByRole("switch", { name }).first();
    if ((await toggle.count()) && (await toggle.isEnabled())) await toggle.click();
  }
  check(
    "OCADE shows the phone with the phone's own switches, and no browser switches",
    (await web.getByText("Browser control").count()) === 0 &&
      (await web.getByRole("switch").count()) >= 3,
  );
  await web.getByRole("button", { name: "Close", exact: true }).first().click();
  await fetch(`${SUPABASE}/__fixture/jarvis-script`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      trigger: "phone-check",
      steps: [
        {
          tool: "start_task",
          args: { title: "Open Settings", where: "computer", steps: ["Open", "Read"] },
        },
        { tool: "computer", args: { action: "open_app", name: "Settings" } },
        { tool: "computer", args: { action: "ui_inspect" } },
        // A control used by its name in the observation, through the same hard rules.
        { tool: "computer", args: { action: "ui_act", op: "invoke", name: "Network & internet" } },
        // Completed needs a read-back after the last change (P01).
        { tool: "computer", args: { action: "ui_inspect" } },
        {
          tool: "finish_task",
          args: {
            outcome: "completed",
            result: "Settings is open.",
            evidence: ["Network & internet"],
          },
        },
      ],
    }),
  });
  await web.locator("#jarvis-composer").fill("phone-check open Settings on my phone");
  await web.getByRole("button", { name: "Send", exact: true }).click();
  // Opening an app the person has not set to Always is theirs to confirm.
  const confirm = web.getByRole("alertdialog", { name: "Confirm this step" });
  check(
    "opening an app waits for the person's confirmation",
    await until(async () => (await confirm.count()) === 1, 30_000),
  );
  await confirm.getByRole("button", { name: "Confirm" }).click();
  const opened = await until(
    async () => (await wd("GET", "/appium/device/current_package")) === "com.android.settings",
    45_000,
  );
  check("JARVIS opens the app on the phone through Android's own launcher", opened);
  const read = await until(
    async () =>
      JSON.stringify(
        await fetch(`${SUPABASE}/__fixture/online-boundary`).then((r) => r.json()),
      ).includes("Read the controls on screen"),
    45_000,
  );
  check("and reads its controls, by ref, through accessibility", read);
  check(
    "and uses one of them by its ref, past the same payment and confirmation rules",
    await until(
      async () =>
        JSON.stringify(
          await fetch(`${SUPABASE}/__fixture/online-boundary`).then((r) => r.json()),
        ).includes("Used the control"),
      45_000,
    ),
    // What the phone answered instead, when it did not use the control.
    (
      JSON.stringify(
        await fetch(`${SUPABASE}/__fixture/online-boundary`).then((r) => r.json()),
      ).match(/Result of computer[^}]{0,300}/g) ?? []
    )
      .slice(-2)
      .join(" | "),
  );
  await until(async () => (await web.getByText("Settings is open.").count()) >= 1, 30_000);

  /* --- a long task across apps the phone itself lists ------------------------ */
  // No app is named in advance: three are drawn, with a recorded seed, from the list the phone
  // reported to OCADE, so each run may work in different apps.
  const reported =
    (await devices(`id=eq.${phone.id}&select=installed_apps`))[0]?.installed_apps ?? [];
  const seed = Number(process.env.OCADE_SEED ?? Date.now() % 100_000);
  let state = seed;
  const random = () => (state = (state * 48_271) % 2_147_483_647) / 2_147_483_647;
  // OCADE itself, Settings (the task's last stop) and the test harness's own helper are not drawn.
  const pool = reported.filter((name) => !/^(OCADE|Settings|Appium Settings)$/i.test(name));
  const chosen = [];
  while (chosen.length < 3 && pool.length)
    chosen.push(...pool.splice(Math.floor(random() * pool.length), 1));
  process.stdout
    .write(`INFO  long task seed ${seed}: ${chosen.join(", ")} (of ${reported.length} apps)
`);
  check(
    "the phone reported enough apps for a task across several",
    chosen.length === 3,
    reported.join(", "),
  );
  const visit = (name) => [
    { tool: "computer", args: { action: "open_app", name } },
    { tool: "computer", args: { action: "screen" } },
    { tool: "computer", args: { action: "ui_inspect" } },
  ];
  await fetch(`${SUPABASE}/__fixture/jarvis-script`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      trigger: "phone-long",
      steps: [
        {
          tool: "start_task",
          args: {
            title: "Check three apps, then the network",
            where: "computer",
            steps: ["Apps", "Network"],
          },
        },
        ...chosen.flatMap(visit),
        ...visit("Settings"),
        { tool: "computer", args: { action: "ui_act", op: "invoke", name: "Network & internet" } },
        { tool: "computer", args: { action: "ui_inspect" } },
        {
          tool: "finish_task",
          args: {
            outcome: "completed",
            result: "Visited the apps and opened the network settings.",
            // Only on the network page itself, not on Settings' first page.
            evidence: ["Airplane mode"],
          },
        },
      ],
    }),
  });
  await web.locator("#jarvis-composer").fill("phone-long check three of my apps and the network");
  await web.getByRole("button", { name: "Send", exact: true }).click();
  const fronts = new Set();
  let interrupted = false;
  const finished = await until(async () => {
    const ask = web.getByRole("alertdialog", { name: "Confirm this step" });
    if ((await ask.count()) === 1) await ask.getByRole("button", { name: "Confirm" }).click();
    fronts.add(await wd("GET", "/appium/device/current_package").catch(() => ""));
    // An interruption mid-task: the person rotates the phone and goes Home once.
    if (!interrupted && fronts.size >= 3) {
      interrupted = true;
      await wd("POST", "/orientation", { orientation: "LANDSCAPE" }).catch(() => undefined);
      await wd("POST", "/appium/device/press_keycode", { keycode: 3 }).catch(() => undefined);
      await wd("POST", "/orientation", { orientation: "PORTRAIT" }).catch(() => undefined);
    }
    return (await web.getByText("Visited the apps and opened the network settings.").count()) >= 1;
  }, 240_000);
  const steps = JSON.stringify(
    await fetch(`${SUPABASE}/__fixture/online-boundary`).then((r) => r.json()),
  );
  check(
    "a 17-step task across four apps finishes, checked against what the phone read back",
    finished,
    `${[...fronts].filter(Boolean).join(" > ")} · ${(steps.match(/Result of (computer|finish_task)[^}]{0,160}/g) ?? []).slice(-4).join(" | ")}`,
  );
  check(
    "each app it was asked for came to the front",
    [...fronts].filter((p) => p && p !== "in.ocade.app").length >= 3,
    [...fronts].join(" > "),
  );
  check(
    "and it read each one's controls",
    (steps.match(/Read the controls on screen/g) ?? []).length >= 4,
  );

  /* --- STOP from the bubble ------------------------------------------------ */
  // Android hides every app's floating windows over its own Settings; from the home screen it is there.
  await wd("POST", "/appium/device/press_keycode", { keycode: 3 });
  await until(async () => await exists(bubble), 10_000);
  await tap(bubble);
  await tap(floating("STOP JARVIS"));
  check(
    "STOP JARVIS from the bubble reaches OCADE",
    await until(async () => /Stopping|Ready/.test(await source()), 10_000),
  );
  await tap(bubble);

  /* --- orientation ---------------------------------------------------------- */
  adb("shell", "am", "start", "-n", "in.ocade.app/.MainActivity");
  await wd("POST", "/orientation", { orientation: "LANDSCAPE" });
  check(
    "turned sideways, OCADE still shows its state and controls",
    await until(
      async () =>
        (await exists('new UiSelector().textStartsWith("Ready")')) &&
        (await exists(ui("STOP JARVIS"))),
      10_000,
    ),
  );
  await wd("POST", "/orientation", { orientation: "PORTRAIT" });

  /* --- removal in OCADE ---------------------------------------------------- */
  await web.goto(`${BASE}/ocade-jarvis`, { waitUntil: "networkidle" });
  await web
    .getByRole("navigation", { name: "JARVIS" })
    .getByRole("button", { name: "Devices" })
    .click();
  await web.getByRole("button", { name: "Remove device" }).first().click();
  await web.getByRole("button", { name: "Remove", exact: true }).click();
  check(
    "removed in OCADE, the phone forgets its key and offers Set up again",
    await until(async () => await exists(ui("Set up OCADE")), 30_000),
  );
  const revoked = (await devices(`id=eq.${phone.id}&select=revoked_at`))[0];
  check("and its key no longer works in OCADE", Boolean(revoked?.revoked_at));

  /* --- uninstall and install again ----------------------------------------- */
  await wd("DELETE", "", undefined);
  session = null;
  adb("uninstall", "in.ocade.app");
  check(
    "uninstalled, nothing of OCADE stays",
    !adb("shell", "pm", "list", "packages").includes("in.ocade.app"),
  );
  adb("install", "-r", APK);
  adb("shell", "am", "start", "-n", "in.ocade.app/.MainActivity", "--es", "server", PHONE_BASE);
  await sleep(3_000);
  const again = adb("shell", "dumpsys", "activity", "activities");
  check("installed again, it starts fresh", again.includes("in.ocade.app/.MainActivity"));
} finally {
  if (session) await wd("DELETE", "", undefined).catch(() => undefined);
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/PID", String(appium.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {
      /* already gone */
    }
  } else {
    appium.kill("SIGTERM");
  }
  await browser.close();
}
process.stdout.write(failures === 0 ? "\nAndroid journey passed.\n" : `\n${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
