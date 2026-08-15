# OCADE Control Engine

This directory contains OCADE's local control-engine bridge and supporting
modules. The shipped application reaches it through `ocade_bridge.py`; the old
standalone PyQt entry points are not part of the packaged product.

## Runtime path

1. The TypeScript control plane creates a signed, scoped request.
2. The Tauri companion passes it to the native Python host.
3. `ocade_bridge.py` validates and routes the request.
4. Windows UI Automation is preferred for observation and element targeting.
5. PyAutoGUI is used only after target resolution, foreground verification and
   the applicable approval check.
6. The result returns as a structured receipt; emergency stop can cancel work.

Browser automation does not run through this Python directory. OCADE's managed
browser host is the sole browser-control path so domain policy, approvals and
receipts cannot be bypassed by a second automation stack.

## Local model and voice

- The configured local planning model is `qwen2.5:3b` through Ollama.
- Windows SAPI provides the default offline voice.
- Faster Whisper is the optional offline speech-to-text path.
- No Google/Gemini SDK is installed for this engine.

## Development

Install dependencies into the native host virtual environment, not system
Python. Run the native host and engine safety suites before packaging. Never
store API keys, personal memory or paired-device credentials in this directory.

## Release warning

Do not distribute the control engine commercially until
`docs/legal/CONTROL_ENGINE_PROVENANCE_REVIEW.md` is closed by a qualified
reviewer. A legacy import in repository history was associated with a
non-commercially licensed reference project; replacing its README does not
resolve source-code provenance.
