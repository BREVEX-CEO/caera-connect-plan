---
name: repository-agent
description: Agent operating guide for OCADE reference-source integration.
---

# OCADE reference integration

This folder is approved reference source for CARCC CADANE / OCADE. It is not wired into the production application.

When integrating later:
- inspect the target OCADE subsystem first;
- adapt only the needed module or behavior;
- preserve OCADE's existing local-first architecture;
- keep task, permission, human-handoff, rate-limit, subscription, Buddy/UI, memory, and tool-lifecycle logic where useful;
- do not recreate removed vendor API, hosted-model, remote-server, external telemetry, OAuth/API-key, or MCP routing;
- run focused tests and the normal OCADE production gates after each integration slice.
