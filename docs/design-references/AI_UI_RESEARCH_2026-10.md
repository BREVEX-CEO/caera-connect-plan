# AI assistant UI research — October 2026

Read-only research for OCADE's design system (21 October 2026). Sources are official product
sites, official docs and design-system packages; values marked "measured" come from CSS the
product serves publicly on its own marketing site, which can differ from the signed-in app. No
app was used signed in. Nothing here is copied into OCADE: it informs original tokens.

## Verified products

ChatGPT (the standalone "ChatGPT agent" is replaced by **ChatGPT Work**:
https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex), Codex
(https://learn.chatgpt.com/docs), Claude and Claude Code, Gemini (Live is inline in the chat;
agent "Gemini Spark"), Microsoft 365 Copilot, Perplexity Comet, Manus, Cursor, Devin, Apple
Intelligence, Samsung Galaxy AI (One UI 8). Grok partly (grok.com CSS; x.ai answered 403). Not
verified: the consumer Copilot app's design, Apple's newer "Siri AI".

## Observed

| Product                                           | Radii                   | Type                        | Dark surfaces                                    | Agent progress                                                                |
| ------------------------------------------------- | ----------------------- | --------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------- |
| OpenAI (`@openai/apps-sdk-ui@0.2.2` tokens)       | 2–24 px + full          | system stack, 10–18 px      | #212121 / #181818 / #131313, borders 12%         | "Worked for 2m 30s", approve or redirect (ChatGPT Work)                       |
| Anthropic (claude.com CSS, measured)              | 2–64 px                 | in-house sans/serif/mono    | warm #141413 / #1a1918                           | Claude Code to-do list (pending / in progress / done), Esc interrupts         |
| Google (gemini.google CSS; Material 3 web tokens) | 20–32 px, pills 100 px  | Google Sans (Flex)          | not published                                    | not published; Spark asks before high-stakes actions                          |
| Microsoft Fluent tokens                           | 2–40 px                 | Segoe UI 10–24 px           | #292929 / #1f1f1f / #141414                      | larger expandable prompt box, tools below                                     |
| Grok (grok.com CSS, measured)                     | 2–32 px, composer 24 px | universalSans, Inter        | ~#050505, 8%, 13% lightness; borders 6–20% white | not published                                                                 |
| Cursor (cursor.com CSS)                           | 2–24 px                 | CursorGothic, Berkeley Mono | #14120b                                          | checkpoints in the timeline; queued messages under the task                   |
| Devin (devin.ai CSS)                              | 4–24 px                 | NB International Pro        | rgb(20,20,20) / rgb(31,31,31)                    | Shell, IDE and browser panes; take over                                       |
| Manus (manus.im CSS)                              | 12 px, 9999 px          | —                           | #1a1a1a / #1f1f1f                                | watch, take over or stop; every action logged                                 |
| Perplexity Comet                                  | —                       | —                           | —                                                | step-by-step in a sidecar; stop and steer; pauses before logins and purchases |

Switches: OpenAI 32×19 px track, 250 ms; Fluent 40×20 px, 18 px thumb; Material 3 52×32 px.
Motion: OpenAI 150 ms; Fluent 100/150/200 ms. Apple HIG: never show state by colour alone.

Sources: https://developers.openai.com/apps-sdk/concepts/ui-guidelines,
https://learn.chatgpt.com/codex/reference/settings, https://learn.chatgpt.com/docs/get-started-with-work,
https://code.claude.com/docs/en/interactive-mode,
https://blog.google/innovation-and-ai/products/gemini-app/next-evolution-gemini-app/,
https://www.microsoft.com/en-us/microsoft-365/blog/2026/05/28/introducing-a-new-design-for-microsoft-365-copilot/,
https://cursor.com/docs/agent/overview, https://docs.devin.ai/get-started/devin-intro,
https://manus.im/docs/integrations/manus-browser-operator,
https://www.perplexity.ai/hub/blog/comet-assistant-puts-you-in-control,
https://developer.apple.com/design/human-interface-guidelines/toggles.

## What OCADE takes (original tokens)

1. Near-black canvas, monochrome controls; colour only for meaning (on, error, success).
2. Radius scale: controls 8 px, rows and compact cards 12 px, dialogs 16 px, task cards and the
   composer 16–24 px, chips, toggles and pill buttons fully round.
3. System font stack; 24 px titles, 16 px section headings, 14–16 px text, 12–13 px notes;
   weights 400/500/600 only.
4. 4 px spacing grid; 36–40 px controls.
5. Motion 120–200 ms, ease-out on enter; reduced motion respected.
6. Switch: pill track about 40×24 px, round thumb, outline when off, fill when on.
7. Agent progress as a short step timeline with plain words ("Thinking", "Working", "Checking")
   and an elapsed time; STOP and Take Over on the task itself; sensitive steps pause and ask.
8. Hierarchy by hairline borders and surface steps, not heavy shadows; blur only on overlays.
9. Settings in few categories with one-line rows and right-aligned controls.
10. Sidebar holds only the work: new, recents, files, settings.
