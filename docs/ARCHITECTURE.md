# OCADE Architecture

## Target shape

```text
Browser / PWA
  │
  ├─ Shell
  │   ├─ Chat
  │   ├─ Library
  │   ├─ Cowork (PLAN2)
  │   └─ Account / Settings
  │
  ├─ Auth authority ─────────────→ Supabase Auth
  ├─ Persistent content ─────────→ Supabase PostgreSQL / private Storage
  ├─ Usage authority ────────────→ server permits + offline reconciliation
  └─ Intelligence router
      ├─ Online OCADE ───────────→ Supabase Edge Function → Gemini
      └─ Offline Intelligence ───→ browser runtime → OPFS model
```

After `PLAN2.md`:

```text
Cowork UI ─┐
           ├─→ one OCADE JARVIS runtime → browser/computer/files/actions
Jarvis UI ─┘
```

## One-authority rule

Do not keep competing old/new implementations. Migration may temporarily need adapters, but the final tree has one authority for identity, usage, online intelligence, offline model lifecycle, Library, Chat and Cowork.

## Storage boundaries

### Supabase

Canonical persistent account content:

- profiles/security/account preferences;
- conversations/messages;
- Library metadata/files/images/outputs;
- usage/entitlements/offline reconciliation;
- notifications/settings;
- billing;
- required hidden Admin/org state;
- minimal Cowork persistence after PLAN2.

### Browser RAM

Transient in-flight UI/runtime state. Incognito-like temporary work, if retained, cannot silently become durable account content.

### OPFS

Offline Intelligence model chunks/binaries and model-owned metadata only.

The website build/version must never be used as the model-cache identity.

## Online intelligence

The browser calls a server/Edge Function boundary. The function reads exactly three optional server secrets. No key enters the client.

## Offline intelligence

The model manager owns:

- device/support detection;
- persistent-storage request;
- manifest/version resolution;
- bounded parallel chunk download;
- resume;
- hash/integrity verification;
- repair;
- explicit remove state;
- runtime startup.

Customer-facing UI subscribes to a small state machine and never needs the raw model name.

## Cloudflare

Cloudflare serves the web/PWA production build and edge gate/health behavior as applicable. Deployment must publish the exact verified tree and preserve OPFS/model data across normal releases.

## Supabase

Supabase owns Auth, PostgreSQL, private Storage, Edge Functions/secrets and server-authoritative account state. Schema changes are migration-driven and verified before/after.

## Cowork/Jarvis

`PLAN2.md` writes one Cowork runtime in OCADE's own architecture — there is no donor tree. The browser UI does not gain a second desktop application, and native helpers, if any prove necessary, are scoped infrastructure rather than a product.

## Removed architecture

The final architecture does not preserve standalone product authorities for Code, Projects, Tasks, Artifacts, Customize, Devices, Search dashboard or old desktop/Copilot merely for backwards compatibility.
