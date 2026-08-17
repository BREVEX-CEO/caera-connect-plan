# OCADE Local Commercial Product Strategy

OCADE's commercial advantage should come from making local AI easier, safer and more capable — not from sending customer prompts to a cloud model or monetising conversation data.

## Core differentiator: Instant Local

**OCADE Instant Local** is the browser/device preparation layer:

- begins preparing the smallest safe local engine shortly after a real site visit;
- keeps completed model data in browser-managed application storage;
- resumes interrupted local downloads where the storage/runtime supports it;
- uses the same Web Lock as Chat so same-origin tabs do not intentionally create duplicate full engines;
- releases the temporary WebGPU worker after cache warming so a landing-page visit does not leave the model resident in RAM/GPU;
- respects Save-Data and browser lifecycle limits;
- never becomes a cloud-model fallback.

This should be positioned as **faster return-to-AI with sovereign inference**, not as a promise that every browser will keep downloading forever after all tabs close. Browser lifecycle policy cannot be overridden by a website.

## Commercial products

### 1. OCADE Personal Local

Entry product for individuals.

Value:
- local chat;
- browser WebGPU/WASM runtime;
- local files and projects;
- offline reuse after successful caching;
- basic device-local memory;
- no public cloud inference.

Commercial role: acquisition funnel and proof of the local-first experience.

### 2. OCADE Pro Local

Paid productivity layer that still runs AI locally.

Potential paid value:
- larger locally licensed/approved model packs where device benchmarks permit them;
- advanced Code and Work tools;
- local automation packs;
- richer document pipelines;
- encrypted local workspace/vault features;
- priority signed runtime/model updates;
- premium support.

Do not sell a larger model until its exact commercial redistribution/use licence has been reviewed.

### 3. OCADE Business

Paid per-user/per-device business workspace.

Potential value:
- company policy controls;
- approved local-model catalogue;
- device inventory and revocation;
- permission templates;
- audit/replay/receipts;
- private sync for selected non-Device-Only data;
- organisation templates and knowledge;
- managed local runtime health;
- admin reporting.

AI inference remains local. Networked account/sync services must stay distinct from inference.

### 4. OCADE Enterprise Sovereign

High-value deployment for regulated companies, governments and restricted environments.

Potential value:
- self-hosted model distribution from the customer's own origin/network;
- air-gapped import packages;
- signed model/runtime manifests;
- fleet rollout and repair;
- policy enforcement;
- on-prem/private sync deployment options;
- SSO/SCIM and enterprise administration;
- dedicated support/SLA;
- deployment validation and security review assistance.

This is the strongest commercial fit for OCADE's local-only architecture because customers pay for control, deployment and assurance rather than token usage.

### 5. OCADE Local Runtime SDK

Developer/commercial licensing layer for companies that want OCADE's local runtime, caching, permission and device orchestration inside their own products.

Potential value:
- browser local-engine coordinator;
- Web Locks/BroadcastChannel single-engine runtime;
- resumable model storage;
- capability probes;
- permission/audit primitives;
- desktop local-engine bridge;
- signed update/runtime tooling.

This must be packaged separately before it is marketed as an available SDK.

## Revenue principles

1. Never sell or share user prompts as the business model.
2. Never reintroduce Gemini/OpenAI/Lovable AI as a hidden fallback to improve conversion metrics.
3. Do not force large background transfers when the user explicitly enables Save-Data.
4. Use clear storage controls so users can inspect/remove locally cached model data.
5. Charge for capability, governance, deployment, support and enterprise assurance.
6. Keep free-launch billing disabled until the payment/product authority explicitly turns commercial checkout back on.
7. Do not advertise a paid tier, SLA, model pack, SDK or enterprise deployment as available until its implementation and release proof exist.

## Browser limitation that marketing must never hide

A website can begin and persist a model download while the page is open. It cannot guarantee that arbitrary JavaScript, workers or service workers continue indefinitely after every tab/window is closed. Chrome/other browsers control those lifetimes.

OCADE therefore uses **start early + persist partial progress + resume later**, which is reliable and honest. A search-result listing alone cannot trigger a model download because OCADE code is not running until the user actually opens an OCADE page or installed app.
