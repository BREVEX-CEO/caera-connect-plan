# macOS bundle component qualification — 5 November 2026

Status: qualification workflow registered; no bundle or consumer-platform PASS
is claimed. W7 remains in progress.

The manual, secrets-free workflow builds on standard macOS 15 ARM64 and Intel
runners. It uses the existing PyInstaller specification and pinned runtime,
embeds its package-local Playwright browser, checks the actual Info.plist and
executable, then exercises frozen MCP workers and a loopback browser fixture
with an empty developer PATH. Component proof is retained for seven days;
no binary, release or deployment is published.

The workflow must be registered on the implementation branch before GitHub can
run it against an unpublished descendant. Its initial acceptance is expected
to fail: the current specification is Windows-only and produces no .app.
That failure must be recorded before implementing the portable specification.

Scope is an executable component bundle. Finder onboarding, automatic startup,
update/rollback, signing/notarization and clean consumer installation remain
separate W9/W10/owner gates. Runner authorization never qualifies a consumer
Mac's Accessibility or Screen Recording permission flow (D16/A2).