"""WEB-001…016 against the controlled fixture site, through the real gateway and a real browser.

Needs a display (run under `xvfb-run` on Linux) and a Chromium build; set
OCADE_BROWSER_EXECUTABLE when Playwright's own browser is not installed. Results
and screenshots go to OCADE_EVIDENCE_DIR when set. Fixture-site passes are L3 for
OCADE's own browser machinery only: they do not qualify third-party websites.
"""

import io
import json
import os
import shutil
import sys
import tempfile
import unittest
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

import anyio
from PIL import Image, ImageStat
from pypdf import PdfReader

from ocade_agent.gateway import PROTOCOL, Gateway
from tests import web_fixture

BROWSER = os.environ.get("OCADE_BROWSER_EXECUTABLE") or shutil.which("chromium")
# Windows runs it only on a disposable CI runner, which may trust the fixture CA.
# macOS can launch a GUI browser without an X11 DISPLAY; Linux needs Xvfb.
READY = bool(BROWSER and (sys.platform == "darwin" or web_fixture.WINDOWS_CI
                          or (sys.platform != "win32" and os.environ.get("DISPLAY"))))
EVIDENCE = os.environ.get("OCADE_EVIDENCE_DIR")


def intent(operation, arguments):
    spec = PROTOCOL["operations"][operation]
    return {
        "v": 1, "key": operation, "operation": operation, "capability": spec["capability"], "risk": spec["risk"],
        "arguments": arguments,
        "deadlineUtc": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat().replace("+00:00", "Z"),
    }


class BrowserUnavailable(unittest.TestCase):
    def test_a_browser_that_cannot_start_is_named_not_a_generic_error(self):
        from unittest.mock import patch

        async def go():
            async with Gateway(tempfile.mkdtemp()) as gateway:
                return await gateway.run(intent("web.open", {"url": "https://example.com/"}), gateway.epoch)

        with patch.dict(os.environ, {"OCADE_BROWSER_EXECUTABLE": str(Path(tempfile.mkdtemp()) / "no-browser")}):
            result = anyio.run(go)
        self.assertEqual((result["status"], result["errorCode"]), ("not_applied", "browser_unavailable"))

    def test_a_browser_that_fails_to_launch_changed_nothing(self):
        """No browser installed where Playwright looks: refused as not applied, never an unknown effect
        that would hold the task for the person (eval s21 web_fact)."""
        from unittest.mock import patch

        async def go():
            async with Gateway(tempfile.mkdtemp(), home=tempfile.mkdtemp()) as gateway:
                return await gateway.run(intent("web.open", {"url": "https://example.com/"}), gateway.epoch)

        environment = {"PLAYWRIGHT_BROWSERS_PATH": tempfile.mkdtemp()}
        with patch.dict(os.environ, environment), patch.dict(os.environ, {"OCADE_BROWSER_EXECUTABLE": ""}):
            result = anyio.run(go)
        if result["status"] == "observed":
            return  # an installed Edge or Chrome started instead (Windows, macOS runners): nothing to check
        self.assertEqual((result["status"], result["maybeChanged"], result["errorCode"]),
                         ("not_applied", False, "browser_unavailable"))


@unittest.skipUnless(READY, "needs a display and a Chromium executable")
class WebLadder(unittest.TestCase):
    def setUp(self):
        self.server, self.base, pin = web_fixture.serve()
        web_fixture.RECEIVED.update(forms=[], uploads=[])
        self.root = Path(tempfile.mkdtemp())
        self.home = Path(tempfile.mkdtemp())
        os.environ["OCADE_BROWSER_EXECUTABLE"] = web_fixture.browser_wrapper(BROWSER, pin)

    @classmethod
    def tearDownClass(cls):
        os.environ["OCADE_BROWSER_EXECUTABLE"] = BROWSER

    def tearDown(self):
        self.server.shutdown()
        os.environ.pop("OCADE_ALLOW_PRIVATE_WEB", None)

    def run_steps(self, steps, private=True):
        if private:
            os.environ["OCADE_ALLOW_PRIVATE_WEB"] = "1"
        else:
            os.environ.pop("OCADE_ALLOW_PRIVATE_WEB", None)

        async def go():
            async with Gateway(str(self.root), home=str(self.home)) as gateway:
                return await steps(lambda op, args: gateway.run(intent(op, args), gateway.epoch), gateway)

        return anyio.run(go)

    def evidence(self, name, path=None, data=None):
        if not EVIDENCE:
            return
        target = Path(EVIDENCE)
        target.mkdir(parents=True, exist_ok=True)
        if path:
            shutil.copy(path, target / name)
        else:
            (target / name).write_text(json.dumps(data, indent=2, default=str))

    def test_mcp_lifespan_closes_browser_and_failed_startup(self):
        """The real registered server lifetime releases pages, Chromium and its driver."""
        from unittest.mock import patch
        from ocade_agent import web_worker

        lifespan = web_worker.app.settings.lifespan
        self.assertTrue(callable(lifespan), "the MCP server must own browser shutdown")
        async def run():
            async with lifespan(web_worker.app):
                opened = await web_worker.web_open(url=self.base + "/")
                self.assertNotIn("refused", opened, opened)
                context = web_worker._browser["context"]
                pages = list(context.pages)
                browser = context.browser
                self.assertTrue(pages)
            self.assertFalse(web_worker._browser, "no stale driver/context may survive shutdown")
            self.assertFalse(web_worker._pages, "closed page identities must not survive shutdown")
            self.assertTrue(all(page.is_closed() for page in pages))
            if browser is not None:
                self.assertFalse(browser.is_connected())
            async with lifespan(web_worker.app):
                with patch.dict(os.environ, {"OCADE_BROWSER_EXECUTABLE": str(self.root / "missing-browser")}):
                    failed = await web_worker.web_open(url=self.base + "/")
                self.assertEqual(failed, {"refused": "browser_unavailable", "maybeChanged": False})
                self.assertFalse(web_worker._browser, "failed launch must release its started driver immediately")
        with patch.object(web_worker, "PROFILE", self.home / "lifecycle-profile"), patch.object(
            web_worker, "PRIVATE_ALLOWED", True
        ), patch.object(web_worker, "WORKSPACE", str(self.root)):
            anyio.run(run)

    def test_download_refusal_after_the_click_preserves_effect_uncertainty(self):
        """The server records a real click; a racing customer file must survive it."""
        import uuid
        from unittest.mock import patch
        from urllib.parse import urlparse

        nonce = uuid.uuid4().hex
        route, download_route = "/" + nonce, "/" + nonce + ".pdf"
        output = "OCADE output/" + nonce + ".pdf"
        destination = self.root / output
        customer_bytes = nonce.encode()
        received = []
        original = web_fixture.Handler.do_GET
        def respond(handler):
            if urlparse(handler.path).path == download_route:
                received.append(handler.path)
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(customer_bytes)
                return handler._send(web_fixture._pdf(), "application/pdf", extra={
                    "content-disposition": "attachment; filename=" + nonce + ".pdf"})
            return original(handler)
        web_fixture.PAGES[route] = '<a href="' + download_route + '" download>Download ' + nonce + '</a>'
        async def steps(run, gateway):
            opened = await run("web.open", {"url": self.base + route})
            self.assertEqual(opened["status"], "observed", opened)
            link = next(control for control in opened["evidence"]["controls"] if control.get("href") == download_route)
            return await run("web.download", {"page": opened["evidence"]["page"], "selector": link["selector"], "output": output})
        try:
            with patch.object(web_fixture.Handler, "do_GET", respond):
                receipt = self.run_steps(steps)
            self.assertEqual(len(received), 1, "the real network effect must be independently witnessed")
            self.assertEqual(destination.read_bytes(), customer_bytes, "the racing customer file must survive")
            self.assertEqual(receipt["status"], "unknown", receipt)
            self.assertTrue(receipt["maybeChanged"], receipt)
        finally:
            web_fixture.PAGES.pop(route, None)


    def test_web_ladder(self):
        base = self.base
        (self.root / "upload-me.txt").write_text("OCADE upload sample\n")
        results = {}

        async def steps(run, gateway):
            out = {}
            opened = await run("web.open", {"url": base + "/"})
            out["001"] = opened
            page = opened["evidence"]["page"]
            out["013"] = await run("web.screenshot", {"page": page, "output": "OCADE output/web/001-home.png"})
            out["002"] = await run("web.read", {"page": page})
            out["table"] = await run("web.open", {"url": base + "/release-table"})
            out["007"] = await run("web.click", {"page": page, "selector": "text=Page one"})
            home = (await run("web.open", {"url": base + "/"}))["evidence"]
            second_next = [c for c in home["controls"] if c["label"] == "Next"][1]
            out["big"] = await run("web.read", {"page": (await run("web.open", {"url": base + "/big"}))["evidence"]["page"]})
            app = (await run("web.open", {"url": base + "/app"}))["evidence"]
            hidden = next(c for c in app["controls"] if c["type"] == "file")
            out["picker"] = await run("web.click", {"page": app["page"], "selector": "text=Open file"})
            out["ask"] = await run("web.open", {"url": base + "/ask"})
            # The click observed the page again, so its selectors are the current ones.
            hidden = next(c for c in out["picker"]["evidence"]["controls"] if c["type"] == "file")
            out["app"] = await run("web.upload", {"page": app["page"], "selector": hidden["selector"], "path": "upload-me.txt"})
            out["app-read"] = await run("web.read", {"page": app["page"]})
            editable = next(c for c in out["app-read"]["evidence"]["controls"] if c["tag"] == "span")
            out["editable"] = await run("web.fill", {"page": app["page"], "selector": editable["selector"], "value": "8"})
            out["editable-read"] = await run("web.read", {"page": app["page"]})
            out["007b"] = await run("web.click", {"page": home["page"], "selector": second_next["selector"]})
            form = (await run("web.open", {"url": base + "/form"}))["evidence"]["page"]
            out["003"] = [
                await run("web.fill", {"page": form, "selector": "#name", "value": "Ada Test"}),
                await run("web.fill", {"page": form, "selector": "#email", "value": "ada@example.test"}),
                await run("web.fill", {"page": form, "selector": "#notes", "value": "Line one"}),
            ]
            await run("web.screenshot", {"page": form, "output": "OCADE output/web/003-form-filled.png"})
            out["004"] = await run("web.click", {"page": form, "selector": "#send"})
            await run("web.screenshot", {"page": form, "output": "OCADE output/web/004-form-sent.png"})
            downloads = (await run("web.open", {"url": base + "/download"}))["evidence"]["page"]
            out["005"] = await run("web.download", {"page": downloads, "selector": "#pdf", "output": "OCADE output/web/report.pdf"})
            upload = (await run("web.open", {"url": base + "/upload"}))["evidence"]["page"]
            out["006"] = [
                await run("web.upload", {"page": upload, "selector": "#file", "path": "upload-me.txt"}),
                await run("web.click", {"page": upload, "selector": "#go"}),
            ]
            frame = (await run("web.open", {"url": base + "/frame"}))["evidence"]["page"]
            out["008"] = await run("web.fill", {"page": frame, "selector": "#inframe", "value": "in frame", "frame": "#inner"})
            popup = (await run("web.open", {"url": base + "/popup"}))["evidence"]["page"]
            out["009"] = [
                await run("web.click", {"page": popup, "selector": "#same"}),
                await run("web.click", {"page": popup, "selector": "#other"}),
            ]
            out["010"] = await run("web.open", {"url": base + "/redirect"})
            login = (await run("web.open", {"url": base + "/login"}))["evidence"]
            out["011"] = [login, await run("web.fill", {"page": login["page"], "selector": "#pass", "value": "x"})]
            out["forged"] = await run("web.read", {"page": {"id": page["id"], "site": "localhost"}})
            out["012"] = await run("web.open", {"url": "https://127.0.0.1:9/unreachable"})
            await gateway._discard("ocade_agent.web_worker")  # the browser process dies
            out["012b"] = await run("web.open", {"url": base + "/pages/2"})
            out["014"] = await run("web.open", {"url": base + "/inject"})
            opened_releases = await run("web.open", {"url": base + "/releases"})
            assert "page" in opened_releases["evidence"], opened_releases  # the refusal, if any, is the evidence
            releases = opened_releases["evidence"]
            out["rows"] = releases["controls"]
            await run("web.read", {"page": releases["page"]})  # a newer observation
            out["stale"] = await run("web.click", {"page": releases["page"], "selector": releases["controls"][0]["selector"]})
            return out

        results = self.run_steps(steps)
        self.evidence("web-ladder-receipts.json", data=results)
        output = self.root / "OCADE output" / "web"

        with self.subTest("WEB-001 open"):
            self.assertEqual(results["001"]["status"], "observed")
            self.assertEqual(results["001"]["evidence"]["title"], "/")
        with self.subTest("WEB-002 read matches an independent fetch"):
            insecure = __import__("ssl")._create_unverified_context()  # the fixture's own throwaway cert
            html = urllib.request.urlopen(self.base + "/", context=insecure).read().decode()
            # A control that opens the file picker is reported, not left waiting for a person.
            self.assertEqual(results["picker"]["status"], "observed", results["picker"])
            self.assertIn("web.upload", results["picker"]["evidence"]["filePicker"])
            # A site's permission request is reported and left for the person; never answered.
            self.assertEqual(sorted(results["ask"]["evidence"]["permissionPrompts"]), ["geolocation", "notifications"])
            self.assertNotIn("permissionPrompts", results["002"]["evidence"])
            # Every observation names the other open tabs, so the planner can switch by page id.
            self.assertNotIn("otherTabs", results["002"]["evidence"])
            self.assertEqual(results["table"]["evidence"]["otherTabs"],
                             [{"page": results["001"]["evidence"]["page"], "title": "/"}])
            [table] = results["table"]["evidence"]["tables"]  # rows keep their cells, links and headers
            self.assertEqual(table["headers"], ["Version", "Date", "Status"])
            self.assertEqual(table["rows"][0]["cells"][:3], ["6.19.6", "2026-01-13", "stable"])
            self.assertTrue(table["rows"][1]["link"].endswith("/pages/2"))
            self.assertEqual(table["totalRows"], 2, "a hidden row is not read as data")
            text = results["002"]["evidence"]["text"]
            for expected in ("OCADE fixture home", "Quarterly status is GREEN.", "Section A"):
                self.assertIn(expected, text)
                self.assertIn(expected, html)
        with self.subTest("WEB-003 fill reads back"):
            self.assertTrue(all(r["evidence"]["matches"] for r in results["003"]))
        with self.subTest("WEB-004 submit reaches the server exactly once"):
            self.assertEqual(len(web_fixture.RECEIVED["forms"]), 1)
            self.assertEqual(web_fixture.RECEIVED["forms"][0]["email"], "ada@example.test")
            self.assertIn("Thanks Ada Test", results["004"]["evidence"]["text"])
        with self.subTest("WEB-005 PDF download is a real PDF"):
            saved = output / "report.pdf"
            self.assertEqual(results["005"]["evidence"]["magic"][:8], b"%PDF".hex())
            self.assertIn("1234.50", PdfReader(saved).pages[0].extract_text())
        with self.subTest("WEB-006 upload: server received the exact file"):
            expected = __import__("hashlib").sha256((self.root / "upload-me.txt").read_bytes()).hexdigest()
            self.assertTrue(results["006"][0]["evidence"]["matches"])
            self.assertEqual(web_fixture.RECEIVED["uploads"], [{"name": "upload-me.txt", "sha256": expected}])
        with self.subTest("WEB-007 internal navigation"):
            self.assertIn("INV-7", results["007"]["evidence"]["text"])
        with self.subTest("WEB-007d a link's address is listed, so it can be opened as seen"):
            links = {c["label"]: c.get("href") for c in results["001"]["evidence"]["controls"]}
            self.assertEqual(links["Page one"], "/pages/1")
        with self.subTest("WEB-007c a click carries a preview of the page afterwards"):
            self.assertTrue(results["007b"].get("preview"))
        with self.subTest("WEB-007b repeated labels still get one-element selectors"):
            self.assertIn("INV-9", results["007b"]["evidence"]["text"])
        with self.subTest("WEB-002b a very large page still reads, bounded"):
            self.assertEqual(results["big"]["status"], "observed")
            self.assertTrue(results["big"]["evidence"]["controls"])
        with self.subTest("WEB-006b a web app that hides and clears its file input still reports the file"):
            self.assertEqual(results["app"]["status"], "observed", results["app"])
            self.assertTrue(results["app"]["evidence"]["matches"])
            self.assertIn("Opened upload-me.txt", results["app-read"]["evidence"]["text"])
        with self.subTest("WEB-003b an app's editable text widget is listed and filled"):
            self.assertTrue(results["editable"]["evidence"]["matches"])
            self.assertIn("End 8", results["editable-read"]["evidence"]["text"])  # typed, then committed on blur
        with self.subTest("WEB-008 same-site iframe"):
            self.assertTrue(results["008"]["evidence"]["matches"])
        with self.subTest("WEB-009 popups: same site bound, other site closed"):
            same, other = results["009"]
            self.assertEqual(len(same["evidence"]["popups"]), 1)
            self.assertRegex(same["evidence"]["popups"][0], "^[0-9a-f]{12}$")
            self.assertEqual(other["evidence"]["popups"], ["closed_off_site"])
        with self.subTest("WEB-010 cross-site redirect refused"):
            self.assertEqual((results["010"]["status"], results["010"]["errorCode"]), ("not_applied", "redirected_off_site"))
        with self.subTest("WEB-011 sign-in is handed to the person"):
            self.assertTrue(results["011"][0]["needsSignIn"])
            self.assertEqual(results["011"][1]["errorCode"], "password_field")
        with self.subTest("WEB-012 failures and browser crash recover without false success"):
            self.assertEqual((results["012"]["status"], results["012"]["errorCode"]), ("not_applied", "navigation_failed"))
            self.assertEqual(results["012b"]["status"], "observed")
        with self.subTest("WEB-013 screenshot is a real PNG"):
            with Image.open(output / "001-home.png") as image:
                self.assertGreater(image.size[0], 100)
        with self.subTest("WEB-014 injected text is returned as data only"):
            self.assertIn("IGNORE ALL PREVIOUS INSTRUCTIONS", results["014"]["evidence"]["text"])
            self.assertEqual(len(web_fixture.RECEIVED["uploads"]), 1)  # nothing new left the computer
        with self.subTest("WEB-015 repeated labels carry their row, so the right one can be chosen"):
            rows = {c["row"]: c["href"] for c in results["rows"] if c["label"] == "Download"}
            self.assertEqual(rows["Build 8.0.1 2026-09-12 Download"], "/pages/2")
            self.assertEqual(len(rows), 3)
        with self.subTest("WEB-016 a selector from an older observation is refused, never retargeted"):
            self.assertEqual((results["stale"]["status"], results["stale"]["errorCode"]), ("not_applied", "stale_selector"))
        with self.subTest("forged page object cannot change the bound site"):
            self.assertEqual(results["forged"]["errorCode"], "site_mismatch")
        for name in ("001-home.png", "003-form-filled.png", "004-form-sent.png"):
            self.evidence(f"WEB-{name}", output / name)

    def test_observed_addresses_are_exact_including_fragments_or_explicitly_omitted(self):
        token = os.urandom(16).hex()
        route = "/" + token * 20
        known = "/" + token * 8 + "?item=" + token + "#/view/" + token
        oversized = "/" + token * 70
        web_fixture.PAGES[route] = (
            '<h1>Address fixture</h1><a href="' + known + '">Known address</a>'
            '<a href="' + oversized + '">Oversized address</a>'
        )
        self.addCleanup(web_fixture.PAGES.pop, route, None)

        async def steps(run, gateway):
            return await run("web.open", {"url": self.base + route})

        result = self.run_steps(steps)
        self.assertEqual(result["status"], "observed", result)
        observed = result["evidence"]
        with self.subTest("page address is not truncated"):
            self.assertEqual(observed["url"], self.base + route)
        links = {control["label"]: control for control in observed["controls"]}
        with self.subTest("link address and SPA fragment remain exact"):
            self.assertEqual(links["Known address"]["href"], known)
        with self.subTest("over-limit addresses are omitted explicitly"):
            self.assertNotIn("href", links["Oversized address"])
            self.assertEqual(links["Oversized address"].get("hrefOmitted"), "too_long")

    def test_private_network_refused_without_owner_flag(self):
        async def steps(run, gateway):
            return [await run("web.open", {"url": self.base + "/"}), await run("web.open", {"url": "https://localhost/"})]

        results = self.run_steps(steps, private=False)
        self.assertEqual([r["errorCode"] for r in results], ["site_not_public", "site_not_public"])

    def test_web_photo_editor_fixture(self):
        """IMG-002 on the local editor fixture: upload, crop 16:9, brighten, label, export."""
        source = Image.new("RGB", (800, 800), (40, 80, 120))
        for x in range(0, 800, 100):
            source.paste((200, 200, 40), (x, 0, x + 50, 800))
        source.save(self.root / "photo.png")
        original = (self.root / "photo.png").read_bytes()

        async def steps(run, gateway):
            page = (await run("web.open", {"url": self.base + "/editor"}))["evidence"]["page"]
            out = [
                await run("web.upload", {"page": page, "selector": "#photo", "path": "photo.png"}),
                await run("web.click", {"page": page, "selector": "#crop"}),
                await run("web.fill", {"page": page, "selector": "#brightness", "value": "40"}),
                await run("web.fill", {"page": page, "selector": "#label", "value": "OCADE TEST"}),
                await run("web.click", {"page": page, "selector": "#apply"}),
                await run("web.screenshot", {"page": page, "output": "OCADE output/web/IMG-002-editor.png"}),
                await run("web.download", {"page": page, "selector": "#export", "output": "OCADE output/web/edited.png"}),
            ]
            return out

        results = self.run_steps(steps)
        self.evidence("IMG-002-receipts.json", data=results)
        for step in results:
            self.assertEqual(step["status"], "observed", step)
        edited = Image.open(self.root / "OCADE output" / "web" / "edited.png").convert("RGB")
        self.assertEqual(edited.size, (800, 450))  # 16:9
        crop = Image.open(io.BytesIO(original)).convert("RGB").crop((0, 175, 800, 625))
        self.assertGreater(ImageStat.Stat(edited).mean[2], ImageStat.Stat(crop).mean[2] + 20)  # brighter
        red = sum(1 for p in edited.crop((20, 20, 400, 80)).get_flattened_data() if p[0] > 230 and p[1] < 60 and p[2] < 60)
        self.assertGreater(red, 200)  # the label was drawn
        self.assertEqual((self.root / "photo.png").read_bytes(), original)
        self.evidence("IMG-002-editor.png", self.root / "OCADE output" / "web" / "IMG-002-editor.png")
        self.evidence("IMG-002-edited.png", self.root / "OCADE output" / "web" / "edited.png")


if __name__ == "__main__":
    unittest.main()


@unittest.skipUnless(READY and os.environ.get("OCADE_PUBLIC_WEB") == "1", "needs a display and OCADE_PUBLIC_WEB=1")
class PublicSite(unittest.TestCase):
    """WEB-001/002/013 on a real public website (example.com), compared with an independent fetch."""

    def test_example_com(self):
        root = Path(tempfile.mkdtemp())

        async def go():
            async with Gateway(str(root), home=tempfile.mkdtemp()) as gateway:
                run = lambda op, args: gateway.run(intent(op, args), gateway.epoch)  # noqa: E731
                opened = await run("web.open", {"url": "https://example.com/"})
                shot = await run("web.screenshot", {"page": opened["evidence"]["page"], "output": "OCADE output/example.png"})
                return opened, shot

        opened, shot = anyio.run(go)
        self.assertEqual(opened["status"], "observed", opened)
        self.assertEqual(opened["evidence"]["title"], "Example Domain")
        independent = urllib.request.urlopen("https://example.com/", timeout=30).read().decode()
        self.assertIn("<title>Example Domain</title>", independent)
        self.assertIn("documentation examples", opened["evidence"]["text"])
        self.assertEqual(shot["status"], "observed")
        if EVIDENCE:
            Path(EVIDENCE).mkdir(parents=True, exist_ok=True)
            shutil.copy(root / "OCADE output" / "example.png", Path(EVIDENCE) / "WEB-001-public-example.com.png")
            (Path(EVIDENCE) / "WEB-001-public-receipt.json").write_text(json.dumps(opened, indent=2))
