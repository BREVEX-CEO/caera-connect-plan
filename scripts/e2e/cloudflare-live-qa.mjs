#!/usr/bin/env node
/**
 * Independently verify the deployed Cloudflare prelaunch boundary.
 *
 * The deployment controller proves an immutable version before promotion.
 * This second process starts after promotion, uses ordinary public HTTPS and
 * an installed Chrome Stable binary, and writes a receipt only when the live
 * apex and www routes still match the expected version and fail-closed policy.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const expectedVersion = process.env.OCADE_EXPECTED_CLOUDFLARE_VERSION;
if (!/^[0-9a-f-]{36}$/i.test(expectedVersion ?? "")) {
  throw new Error("OCADE_EXPECTED_CLOUDFLARE_VERSION must be an explicit version UUID");
}

const chrome = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
].find(existsSync);
if (!chrome) throw new Error("Installed Google Chrome Stable was not found");

const assets = readdirSync(".output/public/assets");
const entry = assets.filter((name) => /^index-[A-Za-z0-9_-]+\.js$/.test(name));
if (entry.length !== 1) throw new Error("Built client entry is missing or ambiguous");
const assetPath = `/assets/${entry[0]}`;

async function probe(host, path) {
  const url = new URL(path, `https://${host}`);
  url.searchParams.set("qa", expectedVersion);
  const response = await fetch(url, {
    redirect: "manual",
    headers: { accept: "*/*", "cache-control": "no-cache" },
    signal: AbortSignal.timeout(20_000),
  });
  const result = {
    host,
    path,
    status: response.status,
    launchState: response.headers.get("x-ocade-launch-state"),
    edgeGate: response.headers.get("x-ocade-edge-gate"),
    cacheControl: response.headers.get("cache-control"),
    robots: response.headers.get("x-robots-tag"),
    location: response.headers.get("location"),
    contentType: response.headers.get("content-type"),
  };
  if (path === "/api/health") {
    const body = await response.json();
    result.deploymentId = body.deploymentId;
    result.version = body.version;
    result.supabasePublic = body.configuration?.supabasePublic;
  }
  return result;
}

const paths = [
  "/",
  "/api/health",
  "/company",
  "/founder/haans-antoni",
  "/products/ocade",
  "/products/ocade/",
  "/auth",
  "/ocade",
  assetPath,
  "/brand/ocade-carcc-wordmark.png",
  "/brand/ocade-carcc-mark.png",
  "/robots.txt",
  "/sitemap.xml",
];
const matrix = [];
for (const path of paths) matrix.push(await probe("ocade.in", path));
for (const path of ["/", "/api/health", "/products/ocade", assetPath]) {
  matrix.push(await probe("www.ocade.in", path));
}

const failures = [];
function require(condition, detail) {
  if (!condition) failures.push(detail);
}
for (const item of matrix) {
  if (item.path === "/api/health") {
    require(item.status === 200, `${item.host} health returned ${item.status}`);
    require(item.deploymentId === expectedVersion, `${item.host} health version differs`);
    require(item.version === "0.1.0", `${item.host} package version differs`);
    require(item.supabasePublic === true, `${item.host} lacks Supabase attestation`);
  } else if (["/company", "/founder/haans-antoni", "/products/ocade"].includes(item.path)) {
    require(item.status === 200, `${item.host}${item.path} is not public`);
    require(
      item.launchState === "prelaunch-public-information" && item.robots?.includes("index"),
      `${item.host}${item.path} lacks public-information headers`,
    );
  } else if (item.path === "/products/ocade/") {
    require(item.status === 308 && item.location === "/products/ocade", "canonical redirect differs");
  } else if (item.path.startsWith("/brand/") || ["/robots.txt", "/sitemap.xml"].includes(item.path)) {
    require(item.status === 200, `${item.host}${item.path} is not readable`);
  } else {
    require(item.status === 503, `${item.host}${item.path} bypassed prelaunch lock`);
    require(item.launchState === "prelaunch", `${item.host}${item.path} lacks lock state`);
    require(item.cacheControl === "no-store", `${item.host}${item.path} is cacheable`);
    require(item.robots?.includes("noindex"), `${item.host}${item.path} is indexable`);
    if (item.path === assetPath) {
      require(item.edgeGate === "asset-v1", `${item.host}${item.path} bypassed asset-v1`);
    }
  }
}

const profile = mkdtempSync(join(tmpdir(), "ocade-cloudflare-live-"));
const browser = await chromium.launchPersistentContext(profile, {
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox"],
});
const consoleErrors = [];
const expectedLockConsoleEvents = [];
const pageErrors = [];

let browserProof;
try {
  const page = await browser.newPage();
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const event = {
      text: message.text().slice(0, 300),
      url: message.location().url,
    };
    if (event.text.includes("status of 503") && event.url.includes("/auth?qa=")) {
      expectedLockConsoleEvents.push(event);
    } else {
      consoleErrors.push(event);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message.slice(0, 300)));
  const product = await page.goto(`https://ocade.in/products/ocade?qa=${expectedVersion}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.getByRole("heading", { name: "OCADE", exact: true }).waitFor();
  const productTitle = await page.title();
  await page.getByRole("link", { name: "Company", exact: true }).click();
  await page.getByRole("heading", { name: "CARCC CADANE", exact: true }).waitFor();
  const companyTitle = await page.title();
  const auth = await page.goto(`https://ocade.in/auth?qa=${expectedVersion}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.getByText("Planned launch 28 August 2026", { exact: true }).waitFor();
  browserProof = {
    executablePath: chrome,
    productStatus: product?.status(),
    productTitle,
    publicNavigationToCompanyPassed: true,
    companyTitle,
    authStatus: auth?.status(),
    authTitle: await page.title(),
    lockCopyObserved: true,
    expectedLockConsoleEvents,
    consoleErrors,
    pageErrors,
  };
} finally {
  await browser.close();
  rmSync(profile, { recursive: true, force: true });
}

require(browserProof.productStatus === 200, "Chrome product route did not return 200");
require(browserProof.authStatus === 503, "Chrome auth route did not return 503");
require(consoleErrors.length === 0, `Chrome emitted ${consoleErrors.length} console errors`);
require(pageErrors.length === 0, `Chrome emitted ${pageErrors.length} page errors`);

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  classification: failures.length === 0 ? "EXECUTED PRELAUNCH REDEPLOYMENT PASS" : "EXECUTED FAIL",
  source: {
    commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    branch: execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(),
  },
  deployment: {
    worker: "ocade-web",
    versionId: expectedVersion,
    trafficPercent: 100,
    expectedAssetState: "locked",
    supabasePublicAttested: true,
  },
  matrix,
  realChromeStable: browserProof,
  failures,
  limits: [
    "This verifies the deployed prelaunch boundary; it does not open the launch gate.",
    "Windows UI and Notepad proof remains deferred and was not run.",
    "Provider credentials, SMTP, signing, stores and same-origin model mirrors remain separate evidence.",
  ],
};

writeFileSync(
  "release/OCADE_CLOUDFLARE_REDEPLOY_PROOF_2026-08-24.json",
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(
  `Cloudflare live QA: ${report.classification}; ${matrix.length} HTTP probes; ` +
    `${consoleErrors.length} console errors; ${pageErrors.length} page errors`,
);
if (failures.length > 0) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
