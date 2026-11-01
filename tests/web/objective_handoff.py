"""Request handoff through the real built JARVIS page; no sign-in or task execution.

Randomized text includes code indentation, significant spaces, Unicode and the
8000-character composer boundary. Runs only against a loopback CI website.
"""
import json
import os
import secrets
import sys
from urllib.parse import quote, urlparse

from playwright.sync_api import expect, sync_playwright


def main(base: str) -> int:
    if os.environ.get("GITHUB_ACTIONS") != "true" or urlparse(base).hostname not in ("127.0.0.1", "localhost"):
        raise RuntimeError("This fixture requires a disposable CI loopback website")
    nonce = secrets.token_hex(16)
    code = f'Repair {nonce}  draft.py without losing this block:\nif ready:\n    print("a  b")\nKeep the original unchanged. Preserve résumé नमस्ते 🌌.'
    boundary = "x" * (8000 - len(nonce)) + nonce
    failures, passed = [], 0
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=os.environ.get("OCADE_BROWSER_EXECUTABLE"))
        try:
            for name, viewport in (("desktop", {"width": 1366, "height": 900}), ("phone", {"width": 390, "height": 844})):
                for label, objective in (("significant whitespace", code), ("8000-character boundary", boundary)):
                    context = browser.new_context(viewport=viewport)
                    try:
                        page = context.new_page()
                        response = page.goto(base.rstrip("/") + "/ocade-jarvis?ask=" + quote(objective, safe=""), wait_until="networkidle")
                        if response is None or response.status != 200:
                            raise AssertionError("The JARVIS page did not load")
                        composer = page.locator("#jarvis-composer")
                        expect(composer).to_have_value(objective)
                        expect(composer).to_have_attribute("maxlength", "8000")
                        page.wait_for_url(lambda url: "ask=" not in str(url))
                        # A reload does not restore consumed handoff text from the address.
                        page.reload(wait_until="networkidle")
                        expect(page.locator("#jarvis-composer")).to_have_value("")
                        passed += 1
                    except Exception as error:
                        failures.append({"viewport": name, "case": label, "error": str(error)[:1000]})
                    finally:
                        context.close()
        finally:
            browser.close()
    print("OCADE_OBJECTIVE_BROWSER:" + json.dumps({"passed": passed, "failed": len(failures), "cases": failures}))
    return 1 if failures or passed != 4 else 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]))
