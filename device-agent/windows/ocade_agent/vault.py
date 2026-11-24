"""THE PERSON'S SIGN-INS, KEPT BY THE OPERATING SYSTEM (plan 14A REPO-55 / REPO-65).

A sign-in is saved on this computer by the person, never by JARVIS: `ocade-agent vault add
https://example.com` asks for the user name and password in the terminal. It is kept in the
operating system's own credential store (Windows Credential Manager, macOS Keychain), under one
exact web origin (scheme, host and port). Nothing here sends it to OCADE's servers, the model,
a log or a screenshot.

JARVIS can only ask the browser worker to SIGN IN on the page it already has open
(`web.sign_in`): the worker looks up the sign-in saved for that page's exact origin and types it
into that page's own login form. A look-alike site, another origin, a page that moved elsewhere
or a form inside a cross-origin frame finds nothing. Removing the sign-in (`vault remove`) takes
effect for the next look-up; nothing is cached.
"""

from __future__ import annotations

import getpass
import json
import os
import subprocess
import sys
from urllib.parse import urlparse

PREFIX = "OCADE sign-in "
# macOS's own Keychain tool, by its fixed system location (never whatever PATH finds first).
SECURITY = os.path.join(os.sep, "usr", "bin", "security")


class VaultUnavailable(Exception):
    """This computer has no supported credential store (only Windows and macOS do)."""


def origin_key(url: str) -> str:
    """The exact origin a sign-in belongs to, e.g. 'https://example.com:443'. HTTPS only."""
    parsed = urlparse(url.strip())
    if parsed.scheme != "https" or parsed.username or parsed.password or not parsed.hostname:
        raise ValueError("a sign-in belongs to one https:// address")
    host = parsed.hostname.encode("idna").decode("ascii").lower()
    return f"https://{host}:{parsed.port or 443}"


class _Store:
    """The operating system's credential store, one entry per origin."""

    def put(self, origin: str, user: str, password: str) -> None:
        raise VaultUnavailable

    def get(self, origin: str) -> tuple[str, str] | None:
        raise VaultUnavailable

    def remove(self, origin: str) -> bool:
        raise VaultUnavailable

    def origins(self) -> list[str]:
        raise VaultUnavailable


class _Windows(_Store):
    def put(self, origin, user, password):
        import win32cred  # type: ignore[import-not-found]

        win32cred.CredWrite({
            "Type": win32cred.CRED_TYPE_GENERIC, "TargetName": PREFIX + origin, "UserName": user,
            "CredentialBlob": password, "Persist": win32cred.CRED_PERSIST_LOCAL_MACHINE}, 0)

    def get(self, origin):
        import pywintypes  # type: ignore[import-not-found]
        import win32cred  # type: ignore[import-not-found]

        try:
            found = win32cred.CredRead(PREFIX + origin, win32cred.CRED_TYPE_GENERIC, 0)
        except pywintypes.error:
            return None
        blob = found["CredentialBlob"]
        return found["UserName"], blob.decode("utf-16-le") if isinstance(blob, bytes) else blob

    def remove(self, origin):
        import pywintypes  # type: ignore[import-not-found]
        import win32cred  # type: ignore[import-not-found]

        try:
            win32cred.CredDelete(PREFIX + origin, win32cred.CRED_TYPE_GENERIC, 0)
            return True
        except pywintypes.error:
            return False

    def origins(self):
        import win32cred  # type: ignore[import-not-found]

        found = win32cred.CredEnumerate(PREFIX + "*", 0) or []
        return sorted(entry["TargetName"][len(PREFIX):] for entry in found)


class _Keychain(_Store):
    """macOS Keychain through the Security framework itself: the password is passed in memory,
    never on a command line or through a terminal. One generic-password item per origin holds
    the user name and password together."""

    NOT_FOUND = -25300  # errSecItemNotFound
    ACCOUNT = b"OCADE"

    def __init__(self):
        import ctypes

        self.ct = ctypes
        self.sec = ctypes.cdll.LoadLibrary("/System/Library/Frameworks/Security.framework/Security")
        self.cf = ctypes.cdll.LoadLibrary("/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation")
        u32, vp = ctypes.c_uint32, ctypes.c_void_p
        self.sec.SecKeychainFindGenericPassword.argtypes = [
            vp, u32, ctypes.c_char_p, u32, ctypes.c_char_p, ctypes.POINTER(u32), ctypes.POINTER(vp),
            ctypes.POINTER(vp)]
        self.sec.SecKeychainAddGenericPassword.argtypes = [
            vp, u32, ctypes.c_char_p, u32, ctypes.c_char_p, u32, ctypes.c_char_p, ctypes.POINTER(vp)]
        self.sec.SecKeychainItemModifyAttributesAndData.argtypes = [vp, vp, u32, ctypes.c_char_p]
        self.sec.SecKeychainItemFreeContent.argtypes = [vp, vp]
        self.sec.SecKeychainItemDelete.argtypes = [vp]
        self.cf.CFRelease.argtypes = [vp]

    def _find(self, origin: str):
        ct = self.ct
        service = (PREFIX + origin).encode()
        length, data, item = ct.c_uint32(), ct.c_void_p(), ct.c_void_p()
        status = self.sec.SecKeychainFindGenericPassword(
            None, len(service), service, len(self.ACCOUNT), self.ACCOUNT,
            ct.byref(length), ct.byref(data), ct.byref(item))
        if status == self.NOT_FOUND:
            return None, None
        if status:
            raise VaultUnavailable(f"keychain status {status}")
        payload = ct.string_at(data, length.value)
        self.sec.SecKeychainItemFreeContent(None, data)
        return payload, item

    def put(self, origin, user, password):
        payload = json.dumps({"user": user, "password": password}).encode()
        _, item = self._find(origin)
        if item is not None:
            status = self.sec.SecKeychainItemModifyAttributesAndData(item, None, len(payload), payload)
            self.cf.CFRelease(item)
        else:
            service = (PREFIX + origin).encode()
            status = self.sec.SecKeychainAddGenericPassword(
                None, len(service), service, len(self.ACCOUNT), self.ACCOUNT, len(payload), payload, None)
        if status:
            raise VaultUnavailable(f"keychain status {status}")

    def get(self, origin):
        payload, item = self._find(origin)
        if item is None:
            return None
        self.cf.CFRelease(item)
        saved = json.loads(payload)
        return saved["user"], saved["password"]

    def remove(self, origin):
        _, item = self._find(origin)
        if item is None:
            return False
        status = self.sec.SecKeychainItemDelete(item)
        self.cf.CFRelease(item)
        return status == 0

    def origins(self):
        # Attributes only (no secrets): the services this companion saved.
        listed = subprocess.run([SECURITY, "dump-keychain"], capture_output=True, text=True, timeout=30,
                                check=False)
        return sorted({line.split("=", 1)[1].strip().strip('"')[len(PREFIX):]
                       for line in listed.stdout.splitlines()
                       if '"svce"' in line and PREFIX in line})


def store() -> _Store:
    if sys.platform == "win32":
        return _Windows()
    if sys.platform == "darwin":
        return _Keychain()
    return _Store()


def sign_in_for(page_url: str) -> tuple[str, str] | None:
    """The sign-in saved for exactly this page's origin, or None. Read fresh every time."""
    try:
        return store().get(origin_key(page_url))
    except ValueError:
        return None


def cli(args: list[str]) -> int:
    """`vault add <https address>` · `vault remove <https address>` · `vault list`."""
    if not args or args[0] not in ("add", "remove", "list") or (args[0] != "list" and len(args) != 2):
        print("usage: vault add|remove <https://address> · vault list", file=sys.stderr)
        return 2
    try:
        if args[0] == "list":
            print(json.dumps(store().origins()))
            return 0
        origin = origin_key(args[1])
        if args[0] == "remove":
            print("removed" if store().remove(origin) else "nothing saved for " + origin)
            return 0
        user = input(f"User name for {origin}: ").strip()
        password = getpass.getpass("Password (not shown): ")
        if not user or not password:
            print("nothing saved", file=sys.stderr)
            return 1
        store().put(origin, user, password)
        print("saved for " + origin)
        return 0
    except ValueError as error:
        print(str(error), file=sys.stderr)
        return 2
    except VaultUnavailable:
        print("this computer has no supported credential store (Windows or macOS)", file=sys.stderr)
        return 1
