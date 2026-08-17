# OCADE Local-Only AI Authority

This document supersedes every earlier OCADE design that allowed Gemini, GPT/OpenAI, Lovable AI or any other public cloud model to answer Chat.

## Hard rules

1. OCADE AI inference is local-only.
2. No public AI-provider API key is read by the Chat path.
3. The retired `/api/ocade/chat` endpoint returns `410` and does not accept/forward prompts.
4. If no local engine can serve a request, OCADE refuses and explains how to start/download a local engine.
5. Desktop local-model pulls retry automatically up to five attempts; completed runtime blobs are reused so interrupted pulls can resume.
6. Browser inference keeps WebGPU as the preferred path, promotes to the larger tier only from real device benchmark evidence, and retains WASM as compatibility fallback.
7. WebGPU model storage remains IndexedDB.
8. Same-origin tabs use an exclusive Web Lock for one browser-model owner. Followers relay over BroadcastChannel and do not load their own engine.
9. If Web Locks/BroadcastChannel are unavailable, OCADE refuses browser inference rather than allowing duplicate full model copies.
10. The service worker retries first-load shell caching and retries again when connectivity returns after a partial first visit.
11. The UI states the unavoidable limitation: the first website delivery needs a connection once. After the app/model are successfully stored, later local-AI visits are designed to work offline.
12. The public landing page starts local-model preparation about 900 ms after a real visit, early enough to begin within a two-second visit on a supported browser.
13. Landing preparation uses the same Web Lock as browser Chat, so multiple same-origin landing tabs do not intentionally start separate model engines.
14. Model preparation uses browser application storage (WebLLM IndexedDB or OCADE-managed OPFS), not the browser Downloads shelf.
15. After a WebGPU cache warm, OCADE unloads the temporary worker/engine so a marketing-page visit does not leave the model resident in RAM/GPU.
16. When WebGPU is unavailable, the compatibility GGUF can be downloaded directly into OCADE-managed storage without loading it into the inference runtime.
17. `Save-Data` is always respected; OCADE does not silently spend hundreds of megabytes after the user explicitly asked the browser to reduce data usage.

## What “local-only AI” does and does not mean

It means prompts are not routed to a public AI model. It does not mean every OCADE feature is network-free. Authentication, optional Supabase Private Sync, live web research, remote-device communication, initial model/app downloads, and similar explicitly networked features can still use a network for their own purpose. They must never become an AI-model fallback.

Authenticated Chat message bodies are stored in account-scoped browser-local storage by `LocalOnlyChatWorkspace`; they are not posted to the retired server chat route.

## First-visit model preparation: exact browser truth

A website can begin a large local-model transfer while its page is open and can persist completed/partial model data in browser-managed storage. It cannot force every browser to keep arbitrary JavaScript, WebGPU workers or service workers alive indefinitely after every tab/window is closed. Browser lifecycle policy always wins.

Therefore OCADE uses a resumable strategy rather than an impossible promise:

- a real landing visit schedules preparation at 900 ms;
- Web Locks prevent duplicate warmers across tabs;
- WebGPU uses WebLLM's IndexedDB cache;
- WASM fallback weights use resumable OCADE-managed storage;
- successful preparation requests persistent storage on a best-effort basis;
- the temporary WebGPU engine is unloaded after warming to release RAM/GPU;
- an interrupted visit leaves partial storage intact and the next real visit retries/resumes it;
- the service worker separately continues/retries application-shell caching for offline navigation;
- no normal file-download API is used, so this path should not create a Chrome Downloads shelf entry or “allow multiple downloads” prompt.

Search-engine result pages cannot run OCADE's JavaScript. A model can start only after the browser actually opens an OCADE page (or an installed OCADE app), not merely because a search result was displayed.

## Browser proof contract

`scripts/local-only-browser-evidence.mjs` is the required real-browser proof. It now:

- opens a fresh-browser OCADE landing page first;
- requires local-model preparation to have entered a real started phase inside the short visit;
- requires zero normal browser download events;
- closes that landing tab after preparation has started, intentionally exercising the interrupted-first-visit path;
- opens three same-origin `/demo/ocade` tabs;
- sends a real message from each;
- requires exactly one Web-Locks leader;
- requires exactly two followers;
- requires the summed diagnostics to show exactly one actual browser-model instance;
- requires follower requests to have been relayed;
- then disables the browser context network;
- reloads the surviving tab;
- sends another real message;
- requires the service worker to control the page and the local model to answer;
- writes `release/OCADE_LOCAL_ONLY_BROWSER_EVIDENCE.json` only after every assertion passes.

## Current execution status

The proof code and workflow are committed, but the most recent GitHub Actions attempts have been blocked before execution by the repository account's Actions billing/spending state. Therefore no new landing-warm-cache, three-tab or offline PASS is claimed from GitHub Actions until a runner actually executes the steps. A committed test is evidence of an intended check, not evidence that the runtime passed it.
