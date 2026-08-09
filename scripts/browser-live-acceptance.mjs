#!/usr/bin/env node
/** Live public-site acceptance through OCADE's production Playwright/CDP host. */
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { createInterface } from "node:readline";

const root = resolve(import.meta.dirname, "..");
const hostPath = join(root, "native", "browser-host", "index.mjs");
const write = process.argv.includes("--write");

function startHost() {
  const child = spawn(process.execPath, [hostPath], {
    cwd: root,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  const pending = new Map();
  let sequence = 0;
  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr = `${stderr}${chunk}`.slice(-4_000)));
  createInterface({ input: child.stdout, crlfDelay: Infinity }).on("line", (line) => {
    const response = JSON.parse(line);
    const waiter = pending.get(response.id);
    if (!waiter) return;
    pending.delete(response.id);
    clearTimeout(waiter.timeout);
    response.ok ? waiter.resolve(response.data) : waiter.reject(new Error(response.error));
  });
  child.once("exit", (code) => {
    for (const waiter of pending.values()) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error(`Browser host exited ${code}: ${stderr}`));
    }
    pending.clear();
  });
  return {
    child,
    call(request, timeoutMs = 45_000) {
      return new Promise((resolveCall, reject) => {
        const id = `live-${++sequence}`;
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`${request.command}/${request.action?.kind ?? ""} timed out`));
        }, timeoutMs);
        pending.set(id, { resolve: resolveCall, reject, timeout });
        child.stdin.write(`${JSON.stringify({ id, version: 1, ...request })}\n`);
      });
    },
  };
}

function stage(message) {
  process.stderr.write(`[OCADE] ${message}\n`);
}

const sessionId = `public-live-${Date.now()}`;
const tempRoot = await mkdtemp(join(tmpdir(), "ocade-browser-live-"));
const profile = join(tempRoot, "chrome-profile");
const host = startHost();
const youtubeOrigin = "https://www.youtube.com";
const exampleOrigin = "https://example.com";
const ianaOrigin = "https://www.iana.org";
const common = { sessionId, approvedOrigins: [youtubeOrigin, exampleOrigin, ianaOrigin] };
const perform = (runId, action, expectation = {}) =>
  host.call({ command: "perform", runId, ...common, action, expectation }, 60_000);

try {
  stage("I’m opening Chrome.");
  const launch = await host.call({
    command: "launch",
    sessionId,
    browser: "chrome",
    headless: false,
    userDataDir: profile,
    explicitProfileApproval: true,
  });
  const month = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(
    new Date(),
  );
  const query = encodeURIComponent(`popular English songs ${month} official audio`);
  await perform(
    "youtube-search",
    { kind: "navigate", url: `${youtubeOrigin}/results?search_query=${query}` },
    { urlContains: "/results" },
  );
  await perform("youtube-result-ready", {
    kind: "wait",
    target: { selector: "ytd-video-renderer a#video-title" },
    timeoutMs: 30_000,
  });
  stage("I found a current popular result.");
  await perform(
    "youtube-open-result",
    { kind: "click", target: { selector: "ytd-video-renderer a#video-title" } },
    { urlContains: "/watch" },
  );
  let watchPage = await perform("youtube-read-watch-page", { kind: "page.read" });
  await perform("youtube-video-ready", {
    kind: "wait",
    target: { selector: "video" },
    timeoutMs: 30_000,
  });
  let media = await perform("youtube-media-before", { kind: "media.read" });
  let video = media.output?.find((item) => item.tag === "video");
  let playbackVerified = false;
  for (let attempt = 0; attempt < 25 && !playbackVerified; attempt += 1) {
    if (!video || video.paused || video.readyState < 2) {
      await perform(`youtube-play-${attempt}`, {
        kind: "click",
        target: { selector: "video" },
      });
    }
    const before = Number(video?.currentTime ?? 0);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 2_000));
    media = await perform(`youtube-media-after-${attempt}`, { kind: "media.read" });
    video = media.output?.find((item) => item.tag === "video");
    playbackVerified = Boolean(
      video &&
      !video.paused &&
      video.currentTime > before &&
      video.readyState >= 2 &&
      (video.duration === null || video.duration > 30),
    );
  }
  if (!playbackVerified) {
    throw new Error(
      `The YouTube video element did not enter observable playback: ${JSON.stringify(video)}`,
    );
  }
  watchPage = await perform("youtube-read-playing-page", { kind: "page.read" });
  if (!watchPage.output?.title || watchPage.output.title === "YouTube") {
    throw new Error("Playback advanced, but YouTube did not expose the selected result title.");
  }
  stage("It’s playing now.");

  const tab = await perform("public-site-new-tab", { kind: "tab.new" });
  await perform(
    "public-site-open",
    { kind: "navigate", url: exampleOrigin, target: { pageIndex: tab.output.pageIndex } },
    { titleContains: "Example Domain" },
  );
  await perform(
    "public-site-follow-link",
    {
      kind: "click",
      target: { pageIndex: tab.output.pageIndex, selector: "a" },
    },
    { urlContains: "iana.org/help/example-domains" },
  );
  await perform("public-site-content-ready", {
    kind: "wait",
    target: { pageIndex: tab.output.pageIndex, selector: "h1" },
    timeoutMs: 30_000,
  });
  const article = await perform("public-site-read", {
    kind: "page.read",
    target: { pageIndex: tab.output.pageIndex },
  });
  const publicSiteVerified =
    article.observation.verified &&
    typeof article.output?.text === "string" &&
    article.output.text.length > 100 &&
    article.output?.url?.startsWith(ianaOrigin);
  if (!publicSiteVerified) {
    throw new Error(
      `The second-tab public-site state was not verified: ${JSON.stringify({ url: article.output?.url, title: article.output?.title, textLength: article.output?.text?.length })}`,
    );
  }

  const evidence = {
    schemaVersion: 1,
    kind: "OCADE_BROWSER_LIVE_ACCEPTANCE",
    result: "PASS",
    recordedAt: new Date().toISOString(),
    executor: "ocade-production-playwright-cdp-host",
    extensionInstalled: false,
    claimBoundary:
      "This proves the production browser host on live public sites. The authenticated conversational Tauri UI was not the command source.",
    browser: { family: launch.browser, connected: launch.connected, profile: "ephemeral-approved" },
    youtube: {
      queryDerivedAtRuntime: true,
      queryMonth: month,
      chosenTitle: watchPage.output.title,
      chosenUrl: watchPage.output.url,
      playback: video,
      verified: playbackVerified,
    },
    publicSite: {
      site: "Example Domain to IANA",
      interaction: "opened a second tab, read the public page and followed its ordinary link",
      url: article.output.url,
      title: article.output.title,
      verified: publicSiteVerified,
    },
  };
  if (write) {
    await mkdir(join(root, "release"), { recursive: true });
    await writeFile(
      join(root, "release", "OCADE_BROWSER_LIVE_ACCEPTANCE.json"),
      `${JSON.stringify(evidence, null, 2)}\n`,
      "utf8",
    );
  }
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
} finally {
  await host.call({ command: "close", sessionId }).catch(() => undefined);
  host.child.kill();
  if (!basename(tempRoot).startsWith("ocade-browser-live-")) {
    throw new Error("Refusing to remove an unexpected browser profile directory.");
  }
  await rm(tempRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}
