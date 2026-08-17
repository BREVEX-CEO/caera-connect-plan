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

## What “local-only AI” does and does not mean

It means prompts are not routed to a public AI model. It does not mean every OCADE feature is network-free. Authentication, optional Supabase Private Sync, live web research, remote-device communication, initial model/app downloads, and similar explicitly networked features can still use a network for their own purpose. They must never become an AI-model fallback.

Authenticated Chat message bodies are now stored in account-scoped browser-local storage by `LocalOnlyChatWorkspace`; they are not posted to the retired server chat route.

## Browser proof contract

`scripts/local-only-browser-evidence.mjs` is the required real-browser proof. It:

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

The proof code and workflow are committed, but GitHub Actions did not start the job because the repository account's Actions billing/spending state blocked runner execution before step 1. Therefore no three-tab or offline PASS is claimed yet. A committed test is evidence of an intended check, not evidence that the runtime passed it.
