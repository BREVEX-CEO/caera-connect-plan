"""Answers from the live web, and an honest answer when there is no web.

WHY THIS IS NOT "OPEN A BROWSER AND SEARCH"
-------------------------------------------
Asked "what is the news today", OCADE used to open Chrome, run a search and
leave the user reading a results page. That is a browser being driven, not a
question being answered. This fetches the snippets, hands them to the model,
and the model answers in the conversation — no window, no tab, no reading.

THE OFFLINE CASE IS THE POINT, NOT AN EDGE
-------------------------------------------
A local-first assistant is used on trains and in basements. The failure that
matters is not "the search failed" — it is a model confidently answering a
question about today from weights frozen months ago. So reachability is checked
FIRST, and when there is no network the reply is a structured refusal carrying
the exact sentence the model must append. The user learns their answer is from
memory rather than from today, which is the difference between stale and wrong.

REACHABILITY IS A SOCKET, NOT A REQUEST
----------------------------------------
A TCP connect to a DNS resolver settles in milliseconds on a live link and
fails immediately on a dead one. An HTTP GET to a website would also test DNS,
TLS, that site's uptime and any captive portal in between — four things that
can fail while the network is fine, each turning a working search into a
false "you are offline".

THREE ENGINES, TRIED IN ORDER, AND THE FALLBACK IS SILENT
----------------------------------------------------------
There used to be exactly one: the `ddgs` library. That made every search as
reliable as one provider on one day, and DuckDuckGo rate-limits — so a burst of
questions (which is what a briefing plus three watched topics IS) returned
"the search could not be completed" for the rest of the minute, and OCADE
reported it as though the internet had gone away.

So there is a chain:

  1. **Brave**, when `BRAVE_SEARCH_API_KEY` is in the environment. A real API
     with a contract, and the only rung that is ever rate-limited honestly.
  2. **Bing's HTML endpoint**, which needs no key. Parsed with BeautifulSoup.
  3. **`ddgs`**, the library, as the last resort.

FALLING BACK IS NOT AN ERROR AND IS NOT REPORTED AS ONE. A rung that returns
nothing, throws, or is not installed moves to the next one WITHOUT a warning in
the receipt, because "Brave is not configured" is not information the person
asking about the weather needs. What the receipt DOES carry is `engine` — which
rung actually answered — so a support question about a bad result can still be
traced. That is the difference between a silent fallback and a hidden one.
"""

from __future__ import annotations

import os
import socket
from typing import Any, Callable

#: Well-known resolvers, tried in order. Two operators so one provider being
#: unreachable is not read as the whole internet being down.
_PROBES = (("1.1.1.1", 53), ("8.8.8.8", 53), ("9.9.9.9", 53))

#: Short on purpose. This runs before every live question, and a slow probe
#: would tax every search to protect against a case that resolves instantly.
_PROBE_TIMEOUT = 1.5

#: What the model must tell the user when it answers without the network.
OFFLINE_NOTE = "Connect to a network for current data."

_MAX_RESULTS = 3
_MAX_SNIPPET = 600

#: Per-engine budget. Three rungs at ten seconds each is a thirty-second search,
#: which is long enough that a user assumes OCADE has hung. Six keeps the whole
#: chain inside the time a person will wait for an answer.
_HTTP_TIMEOUT = 6.0

#: A browser's user agent. Bing serves a JavaScript shell to anything that
#: identifies as a script, so the parse below finds no results at all without
#: it — which read as "the web returned nothing" rather than "we were refused".
_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)


def is_online(timeout: float = _PROBE_TIMEOUT) -> bool:
    """Is there a working route off this machine right now?"""
    for host, port in _PROBES:
        try:
            with socket.create_connection((host, port), timeout=timeout):
                return True
        except OSError:
            continue
    return False


def _clean(text: str, limit: int = _MAX_SNIPPET) -> str:
    collapsed = " ".join((text or "").split())
    return collapsed[:limit]


def _row(title: str, snippet: str, url: str) -> dict[str, str]:
    return {
        "title": _clean(title, 200),
        "snippet": _clean(snippet),
        "url": _clean(url, 400),
    }


# ----------------------------------------------------------------- engines --
#
# Each engine takes (query, max_results, timelimit) and returns rows, or raises.
# RAISING IS THE NORMAL WAY TO DECLINE — a missing key, a missing package, a
# rate limit and a parse failure are all "this rung cannot answer", and the
# caller treats them identically by moving on.


def _via_brave(query: str, max_results: int, timelimit: str | None) -> list[dict[str, str]]:
    """Brave's Search API. Used only when a key is present in the environment."""
    key = (os.environ.get("BRAVE_SEARCH_API_KEY") or "").strip()
    if not key:
        raise LookupError("no Brave key configured")

    import requests  # noqa: PLC0415

    # Brave's freshness vocabulary is pd/pw/pm/py; the caller's is DuckDuckGo's
    # d/w/m/y. Translated here rather than at the call site so every engine
    # takes the same argument and the caller does not have to know whose
    # spelling it is using.
    freshness = {"d": "pd", "w": "pw", "m": "pm", "y": "py"}.get(timelimit or "", "")
    response = requests.get(
        "https://api.search.brave.com/res/v1/web/search",
        params={
            "q": query,
            "count": max(1, min(int(max_results), 20)),
            **({"freshness": freshness} if freshness else {}),
        },
        headers={"Accept": "application/json", "X-Subscription-Token": key},
        timeout=_HTTP_TIMEOUT,
    )
    response.raise_for_status()
    payload = response.json()
    results = ((payload or {}).get("web") or {}).get("results") or []
    rows = [
        _row(item.get("title") or "", item.get("description") or "", item.get("url") or "")
        for item in results
        if isinstance(item, dict)
    ]
    if not rows:
        raise LookupError("Brave returned no rows")
    return rows


def _via_bing_html(query: str, max_results: int, timelimit: str | None) -> list[dict[str, str]]:
    """Bing's ordinary results page, parsed. No key, no account, no SDK."""
    import requests  # noqa: PLC0415
    from bs4 import BeautifulSoup  # noqa: PLC0415

    # Bing's freshness filter is a query-string interval: 1=day, 2=week,
    # 3=month. There is no year, so "y" simply goes unfiltered rather than
    # being approximated by a month — a filter that quietly means something
    # else is worse than no filter.
    interval = {"d": "1", "w": "2", "m": "3"}.get(timelimit or "", "")
    response = requests.get(
        "https://www.bing.com/search",
        params={
            "q": query,
            "count": max(1, min(int(max_results) * 2, 30)),
            "setlang": "en",
            **({"filters": f"ex1:ez{interval}"} if interval else {}),
        },
        headers={"User-Agent": _UA, "Accept-Language": "en-GB,en;q=0.9"},
        timeout=_HTTP_TIMEOUT,
    )
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    rows: list[dict[str, str]] = []
    for item in soup.select("li.b_algo"):
        anchor = item.select_one("h2 a[href]")
        if anchor is None:
            continue
        href = anchor.get("href") or ""
        # Bing wraps some results in a redirector. A row whose URL is not a
        # real destination is worse than a missing row: it is a citation that
        # goes nowhere, and the model will present it as a source.
        if not href.startswith("http"):
            continue
        caption = item.select_one("div.b_caption p") or item.select_one("p")
        rows.append(_row(anchor.get_text(" ", strip=True), caption.get_text(" ", strip=True) if caption else "", href))
        if len(rows) >= max_results:
            break

    if not rows:
        raise LookupError("Bing returned no parseable rows")
    return rows


def _via_ddgs(query: str, max_results: int, timelimit: str | None) -> list[dict[str, str]]:
    """DuckDuckGo through the `ddgs` library. The quiet last resort."""
    from ddgs import DDGS  # noqa: PLC0415

    rows: list[dict[str, str]] = []
    with DDGS() as engine:
        for item in engine.text(
            query,
            region="wt-wt",
            max_results=max(1, min(int(max_results), 10)),
            **({"timelimit": timelimit} if timelimit else {}),
        ):
            if not isinstance(item, dict):
                continue
            rows.append(_row(item.get("title") or "", item.get("body") or "", item.get("href") or ""))
            if len(rows) >= max_results:
                break
    if not rows:
        raise LookupError("DuckDuckGo returned no rows")
    return rows


#: The chain, in order. Named so the receipt can say which one answered.
_ENGINES: tuple[tuple[str, Callable[[str, int, str | None], list[dict[str, str]]]], ...] = (
    ("brave", _via_brave),
    ("bing", _via_bing_html),
    ("duckduckgo", _via_ddgs),
)


def search(
    query: str,
    *,
    max_results: int = _MAX_RESULTS,
    region: str = "wt-wt",  # noqa: ARG001 - see the note below
    timelimit: str | None = None,
) -> dict[str, Any]:
    """Fetch the top snippets for a question, or say why there are none.

    Returns a structured result in every case. A caller must be able to tell
    "no network" from "no results" from "the search failed", because the right
    thing to say to the user is different for each and only the first of them
    means the model should fall back to its own knowledge.

    `region` IS ACCEPTED AND NO LONGER USED, and the parameter stays rather than
    being deleted. It was a DuckDuckGo concept — the other two engines have no
    equivalent — and existing callers pass it positionally-by-keyword. Removing
    it would break them at the call site for no gain; honouring it would mean
    claiming a regional bias the Brave and Bing rungs do not apply.
    """
    query = " ".join((query or "").split())
    if not query:
        return {
            "status": "invalid",
            "query": "",
            "results": [],
            "verified": False,
            "detail": "There was nothing to search for.",
        }

    if not is_online():
        return {
            "status": "offline",
            "query": query,
            "results": [],
            "online": False,
            # The exact wording the model appends, so every offline answer
            # carries the same caveat rather than an improvised one.
            "note": OFFLINE_NOTE,
            "data": (
                "Operating offline. Real-time data unavailable. Use local knowledge, "
                f"but append this note: '{OFFLINE_NOTE}'"
            ),
            "verified": False,
            "detail": f"No network, so “{query}” was answered from local knowledge.",
        }

    wanted = max(1, min(int(max_results), 10))
    rows: list[dict[str, str]] = []
    engine_used = ""
    tried: list[str] = []
    last_error = ""

    for name, engine in _ENGINES:
        tried.append(name)
        try:
            found = engine(query, wanted, timelimit)
        except Exception as error:  # noqa: BLE001
            # Silent by design. The next rung is the answer to this one failing,
            # and a user asking about the weather does not need to hear that an
            # API key is unset.
            last_error = f"{name}: {type(error).__name__}"
            continue
        if found:
            rows = found[:wanted]
            engine_used = name
            break

    if not rows:
        # EVERY RUNG DECLINED. That is materially different from "the web has
        # nothing about this", and only the first of the two means retrying
        # later could help — so they are separate statuses.
        return {
            "status": "failed",
            "query": query,
            "results": [],
            "online": True,
            "enginesTried": tried,
            "verified": False,
            "detail": (
                "No search engine could be reached, though the network is up"
                + (f" (last: {last_error})." if last_error else ".")
            ),
        }

    # Pre-formatted for the model, so every caller presents sources the same
    # way and a snippet cannot arrive as an unlabelled wall of text.
    formatted = "\n\n".join(
        f"[{index + 1}] {row['title']}\n{row['snippet']}\nSource: {row['url']}"
        for index, row in enumerate(rows)
    )
    return {
        "status": "online",
        "query": query,
        "results": rows,
        "online": True,
        "count": len(rows),
        "engine": engine_used,
        "enginesTried": tried,
        "data": formatted,
        "verified": True,
        "detail": f"Read {len(rows)} live result(s) for “{query}”.",
    }
