/**
 * OCADE's look, checked in a real browser at every size that matters.
 *
 * For each screen, at desktop, tablet and phone widths and in dark and light,
 * this takes a screenshot (for a person to review) and fails on what a
 * screenshot must never show: horizontal overflow, a page error, or a control
 * outside the viewport. A DOM that passes but looks wrong still needs the
 * screenshots read; they are written to OCADE_VISUAL_DIR (default: a temp dir).
 *
 * Usage: node scripts/e2e/visual-journey.mjs [--base=…] [--supabase=…]
 */
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const arg = (name, fallback) => {
  const found = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};
const BASE = arg("base", "http://127.0.0.1:8788");
const SUPABASE = arg("supabase", "http://127.0.0.1:54321");
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const OUT = process.env.OCADE_VISUAL_DIR ?? path.join(tmpdir(), "ocade-visual");
mkdirSync(OUT, { recursive: true });

let failures = 0;
function check(name, ok, detail = "") {
  if (!ok) failures += 1;
  process.stdout.write(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}\n`);
}

const SIZES = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "phone", width: 375, height: 812 },
];
const THEMES = ["dark", "light"];

const storageKey = `sb-${new URL(SUPABASE).hostname.split(".")[0]}-auth-token`;
const session = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: `visual-${Date.now()}@ocade.test`, password: "proof" }),
}).then((r) => r.json());

/** Screens, each opened fresh; `act` brings it to the state worth looking at. */
const SCREENS = [
  { name: "chat-signed-out", path: "/", signedIn: false },
  { name: "jarvis-signed-out", path: "/ocade-jarvis", signedIn: false },
  { name: "help", path: "/help", signedIn: false },
  { name: "privacy", path: "/privacy", signedIn: false },
  { name: "pricing", path: "/pricing", signedIn: false },
  { name: "chat", path: "/", signedIn: true },
  { name: "jarvis", path: "/ocade-jarvis", signedIn: true },
  {
    name: "jarvis-devices",
    path: "/ocade-jarvis",
    signedIn: true,
    act: async (page, size) => {
      if (size.name === "phone") {
        await page.getByRole("button", { name: "Open navigation", exact: true }).click();
      }
      await page
        .getByRole("navigation", { name: "JARVIS" })
        .last()
        .getByRole("button", { name: "Devices" })
        .click();
    },
  },
  {
    name: "settings",
    path: "/ocade-jarvis",
    signedIn: true,
    act: async (page, size) => {
      if (size.name === "phone") {
        await page.getByRole("button", { name: "Open navigation", exact: true }).click();
      }
      await page
        .getByRole("navigation", { name: "JARVIS" })
        .last()
        .getByRole("button", { name: "Settings" })
        .click();
    },
  },
];

const browser = await chromium.launch({ executablePath: EXECUTABLE });
try {
  for (const theme of THEMES) {
    for (const size of SIZES) {
      for (const screen of SCREENS) {
        const context = await browser.newContext({
          viewport: { width: size.width, height: size.height },
          colorScheme: theme,
          reducedMotion: "reduce",
        });
        await context.addInitScript(
          ([key, value, prefs]) => {
            if (value) window.localStorage.setItem(key, value);
            window.localStorage.setItem("ocade:appearance:v1", prefs);
          },
          [
            storageKey,
            screen.signedIn ? JSON.stringify(session) : "",
            JSON.stringify({ theme, reducedMotion: true, highContrast: false }),
          ],
        );
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(String(error).slice(0, 160)));
        const label = `${screen.name} · ${size.name} · ${theme}`;
        try {
          await page.goto(`${BASE}${screen.path}`, { waitUntil: "networkidle" });
          if (screen.act) await screen.act(page, size).catch(() => undefined);
          await page.waitForTimeout(600);
          const layout = await page.evaluate(() => {
            const root = document.scrollingElement ?? document.documentElement;
            const outside = [...document.querySelectorAll("button, a, input, textarea, select")]
              .filter((el) => {
                const r = el.getBoundingClientRect();
                const style = getComputedStyle(el);
                // Skip links sit off-screen by design until they are focused.
                if (el.classList.contains("skip-link")) return false;
                // Inside a horizontal scroll strip (phone tabs) a control may sit past the edge.
                for (let up = el.parentElement; up; up = up.parentElement) {
                  const x = getComputedStyle(up).overflowX;
                  if (x === "auto" || x === "scroll") return false;
                }
                if (r.width === 0 || style.visibility === "hidden" || style.display === "none") {
                  return false;
                }
                return r.right > window.innerWidth + 1 || r.left < -1;
              })
              .map((el) => el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 30));
            return { overflow: root.scrollWidth - window.innerWidth, outside };
          });
          check(`${label}: no horizontal overflow`, layout.overflow <= 1, `${layout.overflow}px`);
          check(
            `${label}: every control is inside the screen`,
            layout.outside.length === 0,
            layout.outside.slice(0, 5).join(", "),
          );
          check(`${label}: no page errors`, errors.length === 0, errors.join(" | "));
          await page.screenshot({
            path: path.join(OUT, `${screen.name}-${size.name}-${theme}.png`),
            fullPage: false,
          });
        } catch (error) {
          check(`${label}: opens`, false, String(error).slice(0, 200));
        } finally {
          await context.close();
        }
      }
    }
  }
} finally {
  await browser.close();
}

process.stdout.write(`Screenshots: ${OUT}\n`);
process.exit(failures === 0 ? 0 : 1);
