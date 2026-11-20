/**
 * Chat-app notifications (REPO-20): only the four providers' own webhook hosts over HTTPS are
 * accepted (no internal or arbitrary address can be reached), and the message is bounded text.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { chatHookKind, chatRequest } from "../../src/lib/notifications/chat-hook.ts";

test("only provider webhook addresses are accepted", () => {
  assert.equal(chatHookKind("https://hooks.slack.com/services/T000/B000/XXXXXXXXXX"), "slack");
  assert.equal(
    chatHookKind("https://discord.com/api/webhooks/123456789/abcdefghijklmnopqrstuvwxyz"),
    "discord",
  );
  assert.equal(chatHookKind("https://ntfy.sh/my-ocade-topic"), "ntfy");
  assert.equal(
    chatHookKind("https://contoso.webhook.office.com/webhookb2/abc-def/IncomingWebhook/x"),
    "teams",
  );
  for (const refused of [
    "http://hooks.slack.com/services/T000/B000/XXXXXXXXXX",
    "https://hooks.slack.com:8443/services/T000/B000/XXXXXXXXXX",
    "https://user:pw@hooks.slack.com/services/T000/B000/XXXXXXXXXX",
    "https://hooks.slack.com.evil.example/services/T000/B000/XXXXXXXXXX",
    "https://169.254.169.254/latest/meta-data",
    "https://localhost/api/webhooks/1/2",
    "https://discord.com/api/other/123456789/abcdefghijklmnopqrstuvwxyz",
    "https://ntfy.sh/x",
    "not a url",
  ]) {
    assert.equal(chatHookKind(refused), null, refused);
  }
});

test("each provider gets bounded text in its own format", () => {
  const message = {
    title: "Task done",
    body: "x".repeat(5000),
    link: "https://ocade.in/ocade-jarvis",
  };
  const slack = JSON.parse(chatRequest("slack", message).body);
  assert.ok(slack.text.startsWith("Task done\n") && slack.text.length < 1300);
  assert.ok(JSON.parse(chatRequest("discord", message).body).content.length <= 1900);
  const ntfy = chatRequest("ntfy", { ...message, title: "Fertig ✓" });
  assert.equal(ntfy.headers.Title, "Fertig ");
  assert.match(ntfy.body, /ocade-jarvis$/);
});
