import { webkit, devices } from "playwright-core";
const dir = process.argv[2];
const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["iPhone 15"];
const context = await webkit.launchPersistentContext(dir, { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });
const page = context.pages()[0] ?? (await context.newPage());
const problems = [];
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && !/preloaded using link preload/.test(m.text()) && problems.push(`${m.type()} ${page.url()} ${m.text().slice(0, 160)}`));
page.on("pageerror", (e) => problems.push(`pageerror ${page.url()} ${String(e).slice(0, 160)}`));
for (const path of ["/ocade-jarvis", "/auth?next=%2Focade-jarvis", "/", "/help"]) {
  await page.goto(`http://localhost:8788${path}`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const h1 = await page.evaluate(() => [...document.querySelectorAll("h1")].map((h) => h.textContent).join("|"));
  console.log(path, "->", page.url().replace("http://localhost:8788", ""), "h1:", h1);
}
const sw = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.scriptURL ?? "none");
console.log("sw", sw, problems.length ? problems : "clean");
await context.close();
