import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { build } from "esbuild";
import { chromium } from "playwright-core";

const root = resolve(process.env.OCADE_TEST_ROOT || ".");
const packageRoot = resolve(import.meta.dirname, "../node_modules");

async function inBrowser(source, verify) {
  const dir = await mkdtemp(join(tmpdir(), "ocade-browser-"));
  let browser;
  try {
    const bundle = join(dir, "app.js");
    await build({
      absWorkingDir: root,
      nodePaths: [packageRoot],
      stdin: { contents: source, resolveDir: root, loader: "tsx" },
      outfile: bundle,
      jsx: "automatic",
      bundle: true,
      plugins: [
        {
          name: "isolated-page-context",
          setup(plugin) {
            const stubs = {
              "@/lib/session":
                "export const useSession = () => ({ user: { id: window.account } });",
              "@/components/shell/PublicPage":
                "export const PublicPage = ({ children }) => children;",
              "@tanstack/react-router":
                "export const createFileRoute = () => x => x; export const Link = ({children}) => children;",
            };
            plugin.onResolve(
              {
                filter:
                  /^(?:@\/lib\/session|@\/components\/shell\/PublicPage|@tanstack\/react-router)$/,
              },
              ({ path }) => ({ path, namespace: "isolated-page-context" }),
            );
            plugin.onLoad({ filter: /.*/, namespace: "isolated-page-context" }, ({ path }) => ({
              contents: stubs[path],
            }));
          },
        },
      ],
    });
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
    const page = await browser.newPage();
    await page.route("https://ocade.invalid/", (route) =>
      route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }),
    );
    await page.goto("https://ocade.invalid/");
    await page.addScriptTag({ path: bundle });
    await verify(page);
  } finally {
    await browser?.close();
    await rm(dir, { recursive: true, force: true });
  }
}

const render =
  'import {createRoot} from "react-dom/client"; const root = createRoot(document.getElementById("root"));';
test("Answer language reloads when the signed-in account changes", () =>
  inBrowser(
    `${render}
   import {AnswerLanguage} from "./src/components/settings/AnswerLanguage";
   import {ANSWER_LANGUAGES, saveAnswerLanguage} from "./src/lib/chat/answer-language";
   saveAnswerLanguage("first", ANSWER_LANGUAGES[1]); saveAnswerLanguage("second", ANSWER_LANGUAGES[2]);
   window.switchAccount = id => { window.account = id; root.render(<AnswerLanguage />); };
   window.switchAccount("first");`,
    async (page) => {
      const select = page.getByRole("combobox", { name: "Answer language" });
      await select.waitFor();
      const second = await select.locator("option").nth(2).getAttribute("value");
      await page.evaluate(() => window.switchAccount("second"));
      await page.waitForFunction(
        (expected) => document.querySelector("select")?.value === expected,
        second,
        { timeout: 1500 },
      );
    },
  ));

test("Help search accepts punctuation in natural questions", () =>
  inBrowser(
    `${render}
   import {Route} from "./src/routes/help";
   const Help = Route.component; root.render(<Help />);`,
    async (page) => {
      await page.getByRole("searchbox", { name: "Search Help" }).fill("offline chat?");
      assert.match(await page.getByRole("status").textContent(), /answers? found/);
    },
  ));

test("Help contact guidance stays available after a topic filter", () =>
  inBrowser(
    `${render}
   import {Route} from "./src/routes/help";
   const Help = Route.component; root.render(<Help />);`,
    async (page) => {
      await page.getByRole("button", { name: "Mobile", exact: true }).click();
      const contact = page.getByRole("button", { name: "How do I contact OCADE?", exact: true });
      await contact.click({ timeout: 1500 });
      assert.equal(await contact.getAttribute("aria-expanded"), "true");
    },
  ));
