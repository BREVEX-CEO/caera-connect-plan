"""REPO-55/65: the person's saved sign-ins are used only on their exact origin, the password never
reaches JARVIS's result, and removing a sign-in stops its use at once."""

import os
import shutil
import sys
import unittest
from unittest import mock

import anyio

from ocade_agent import vault

BROWSER = os.environ.get("OCADE_BROWSER_EXECUTABLE") or shutil.which("chromium")
LOGIN = """<form action="/session" method="post">
  <label>Email <input id="user" type="email" autocomplete="username"></label>
  <label>Password <input id="pass" type="password" autocomplete="current-password"></label>
  <button>Sign in</button></form>"""


class MemoryStore(vault._Store):
    def __init__(self):
        self.saved = {}

    def put(self, origin, user, password):
        self.saved[origin] = (user, password)

    def get(self, origin):
        return self.saved.get(origin)

    def remove(self, origin):
        return self.saved.pop(origin, None) is not None

    def origins(self):
        return sorted(self.saved)


class OriginKeys(unittest.TestCase):
    def test_one_exact_https_origin(self):
        self.assertEqual(vault.origin_key("https://Bank.Example/login?x=1"), "https://bank.example:443")
        self.assertEqual(vault.origin_key("https://bank.example:8443/"), "https://bank.example:8443")
        for refused in ("http://bank.example/", "https://user:pw@bank.example/", "file:///etc/passwd", "bank.example"):
            with self.assertRaises(ValueError, msg=refused):
                vault.origin_key(refused)

    def test_a_look_alike_or_subdomain_finds_nothing(self):
        store = MemoryStore()
        store.put("https://bank.example:443", "ann", "pw-1")
        with mock.patch.object(vault, "store", return_value=store):
            self.assertEqual(vault.sign_in_for("https://bank.example/login"), ("ann", "pw-1"))
            for other in ("https://bank.example.evil/login", "https://login.bank.example/",
                          "https://bank.example:444/", "http://bank.example/"):
                self.assertIsNone(vault.sign_in_for(other), other)

    def test_a_computer_without_a_store_says_so(self):
        with mock.patch.object(vault, "store", return_value=vault._Store()):
            with self.assertRaises(vault.VaultUnavailable):
                vault.sign_in_for("https://bank.example/")


@unittest.skipUnless(BROWSER, "needs a Chromium executable")
class SignIn(unittest.TestCase):
    def run_sign_in(self, store, page_url, *, remove_first=False):
        from playwright.async_api import async_playwright

        from ocade_agent import web_worker

        async def go():
            async with async_playwright() as playwright:
                browser = await playwright.chromium.launch(executable_path=BROWSER)
                try:
                    page = await browser.new_page()
                    await page.route("**/*", lambda route: route.fulfill(content_type="text/html", body=LOGIN))
                    await page.goto(page_url)
                    origin = web_worker._origin(page_url)
                    web_worker._pages["t"] = {"page": page, "site": origin[1], "origin": origin}
                    if remove_first:
                        store.remove(vault.origin_key(page_url))
                    with mock.patch.object(vault, "store", return_value=store):
                        result = await web_worker.web_sign_in({"id": "t", "site": origin[1]})
                    typed = (await page.locator("#user").input_value(), await page.locator("#pass").input_value())
                    return result, typed
                finally:
                    web_worker._pages.pop("t", None)
                    await browser.close()

        return anyio.run(go)

    def store(self):
        store = MemoryStore()
        store.put("https://bank.example:443", "ann@example.test", "correct horse 9")
        return store

    def test_the_saved_sign_in_fills_its_own_site_and_the_result_holds_no_secret(self):
        result, typed = self.run_sign_in(self.store(), "https://bank.example/login")
        self.assertEqual(typed, ("ann@example.test", "correct horse 9"))
        self.assertEqual(result["filled"], ["user name", "password"])
        self.assertNotIn("correct horse 9", repr(result))
        self.assertNotIn("ann@example.test", repr(result))

    def test_a_phishing_origin_gets_nothing(self):
        result, typed = self.run_sign_in(self.store(), "https://bank-example.evil/login")
        self.assertEqual(result["refused"], "no_saved_sign_in")
        self.assertEqual(typed, ("", ""))

    def test_a_removed_sign_in_is_not_used(self):
        result, typed = self.run_sign_in(self.store(), "https://bank.example/login", remove_first=True)
        self.assertEqual(result["refused"], "no_saved_sign_in")
        self.assertEqual(typed, ("", ""))


class Cli(unittest.TestCase):
    def test_add_list_remove(self):
        store = MemoryStore()
        with mock.patch.object(vault, "store", return_value=store), \
                mock.patch("builtins.input", return_value="ann"), \
                mock.patch("getpass.getpass", return_value="pw-2"), \
                mock.patch("builtins.print"):
            self.assertEqual(vault.cli(["add", "https://bank.example"]), 0)
            self.assertEqual(store.saved, {"https://bank.example:443": ("ann", "pw-2")})
            self.assertEqual(vault.cli(["remove", "https://bank.example/"]), 0)
            self.assertEqual(store.saved, {})
            self.assertEqual(vault.cli(["add", "http://bank.example"]), 2)
            self.assertEqual(vault.cli(["oops"]), 2)


if __name__ == "__main__":
    unittest.main()


class _OperatingSystemStore:
    def test_save_read_replace_and_remove_a_sign_in(self):
        store = vault.store()
        origin = f"https://ocade-test-{os.getpid()}.example:443"
        try:
            store.put(origin, "ann", "first pass")
            self.assertEqual(store.get(origin), ("ann", "first pass"))
            store.put(origin, "ann", "second pass é")
            self.assertEqual(store.get(origin), ("ann", "second pass é"))
        finally:
            removed = store.remove(origin)
        self.assertTrue(removed)
        self.assertIsNone(store.get(origin))


@unittest.skipUnless(sys.platform == "win32", "needs the Windows credential store")
class WindowsCredentialStore(_OperatingSystemStore, unittest.TestCase):
    pass


@unittest.skipUnless(sys.platform == "darwin", "needs the macOS Keychain")
class MacKeychain(_OperatingSystemStore, unittest.TestCase):
    pass
