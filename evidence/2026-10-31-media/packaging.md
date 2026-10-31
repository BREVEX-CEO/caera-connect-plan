# Companion packaging check — 31 October 2026 (Linux build of the shipped spec)

The Windows installer can only be built and qualified on Windows (PyInstaller is not a cross-compiler), so
this run built the **same** `device-agent/windows/packaging/ocade-agent.spec` on Linux (PyInstaller 6.16.0,
Python 3.13) to test what the spec bundles and how the frozen executable starts its workers.

Defects found and fixed (both would have shipped a Windows build that cannot work):
1. The frozen entry script `ocade_agent/__main__.py` used a relative import; a frozen build runs it as a plain
   script, so `ocade-agent` exited at once with `ImportError`. Now an absolute import.
2. `collect_submodules("ocade_agent")` ran in a child process that could not see the source tree and returned
   an empty list, so no worker module was bundled (`No module named ocade_agent.media_worker`). The spec now lists
   the package's modules from disk and fails the build if any worker is missing.

Result after the fixes: `OCADE JARVIS/ocade-agent` and `ocade-agent-bg` (277 MB with the Python runtime and
dependencies). `packaging/check_frozen.py` started all five workers from the frozen executable over MCP with
`PATH` holding only FFmpeg (no Python, no Node): office 7 tools, verifier 2, media 5 (inspected an image),
web 9, windows 7. A frozen media worker also rendered a 3D scene through the bundled Playwright driver.

Still BLOCKED: the Windows build itself, Inno Setup installer, code signing, DPAPI, per-user start-up, clean
non-admin Windows machines (no Windows host, no certificate). FFmpeg is not bundled (its licence and build
options need review); without it, the media operations are reported unavailable before a task starts.
Chromium is not bundled for customers either: on Windows the companion uses the installed Microsoft Edge.
