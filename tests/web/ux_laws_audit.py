"""Measurable UX-law checks on every reachable page of a running OCADE site (plan 14B.4, 14B.4A).

Each check is a fact a browser can measure. It does not certify that a principle is "applied";
it catches the regressions that break one. The per-principle evidence matrix in
the UX matrix in `PROGRESS.md` says which check backs which principle and what stays a human review.

- UX-07 Fitts's Law: every visible control is at least 24 x 24 CSS px (WCAG 2.5.8), except a link
  inside running text.
- UX-10 Hick's Law / UX-18 Miller's Law: a navigation landmark shows at most 9 choices at once.
- UX-11 Jakob's Law: the page has a language, a title and a way home.
- UX-31 Visual Hierarchy: exactly one visible level-1 heading; heading levels never skip.
- UX-24 Postel's Law: email and password fields say what they hold (`type`/`autocomplete`), so
  browsers and password managers fill them.
- UX-06 Doherty Threshold: the page's document is ready within 1 s on a loopback site.
- UX-08 Flow / UX-01: with reduced motion requested, nothing animates for longer than 10 ms.
- UX-28 Von Restorff Effect: a visible STOP control does not share its colour with any other button.
- UX-14 Prägnanz / UX-31: no text is cut off by its container without an ellipsis.
- UX-04 Cognitive Bias: no consent or marketing checkbox is pre-checked.
- UX-05 Cognitive Load: one form never shows more than 8 fields at once.
- UX-20 Paradox of the Active User: no dialog covers a page on first load, so use starts at once.
- UX-25 Selective Attention: no media plays sound on its own.
- UX-34 Feedback Loops: a field marked invalid points to visible text that says why.
- UX-13 Proximity: a field's label and stated reason sit within 48 px of it.
- UX-12 Common Region: the choices of one radio group share a named boundary.
- UX-15 Similarity: buttons with one name on one page look alike, and one link name never leads to two pages.
- UX-03 Chunking: a page body never shows more than 12 controls outside a named group, list or table.
- UX-02 Choice Overload: a dialog offers at most 4 buttons, and a select without groups at most 15 options.
- UX-32 Progressive Disclosure: a section named advanced, developer or expert is folded on first view.
- UX-26 Serial Position: a dialog's cancel or close control is its first or last button, never in the middle.
- UX-01 Aesthetic-Usability: a page uses at most 3 type families (monospace code excepted).
- UX-19 Occam's Razor: no container repeats a button or link with the same name beside its twin.
- UX-09 Goal-Gradient: a progress bar has a name and only a valid value, never an invented one.

    python3 tests/web/ux_laws_audit.py http://127.0.0.1:8787 [session.json storage-key] [--engine E]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).parent))
import accessibility_audit
import surface_audit

MIN_TARGET = 24
MAX_NAV_CHOICES = 9
READY_MS = 1000
MAX_FORM_FIELDS = 8
MAX_LABEL_GAP = 48
MAX_UNGROUPED = 12

MEASURE = """({minTarget, maxNav, maxFields, maxGap, maxUngrouped, opened}) => {
  const out = [];
  const visible = el => {
    const s = getComputedStyle(el);
    const b = el.getBoundingClientRect();
    return s.visibility !== 'hidden' && s.display !== 'none' && b.width > 0 && b.height > 0
      && !el.closest('[aria-hidden="true"], [inert], .sr-only');
  };
  const name = el => (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.tagName)
    .trim().replace(/\\s+/g, ' ').slice(0, 50);
  // UX-07: target size. A link inside running text is exempt (WCAG 2.5.8 inline exception).
  const controls = document.querySelectorAll('a[href], button, [role="button"], input:not([type="hidden"]), select, textarea, summary');
  for (const el of controls) {
    if (!visible(el)) continue;
    const b = el.getBoundingClientRect();
    if (b.width >= minTarget && b.height >= minTarget) continue;
    const inline = el.tagName === 'A' && getComputedStyle(el).display === 'inline'
      && el.parentElement && /^(P|LI|SPAN|SMALL|TD|DD|LABEL|EM|STRONG)$/.test(el.parentElement.tagName);
    if (inline) continue;
    // A checkbox or radio inside its label: the label is the target.
    if ((el.type === 'checkbox' || el.type === 'radio') && el.closest('label')) {
      const l = el.closest('label').getBoundingClientRect();
      if (l.width >= minTarget && l.height >= minTarget) continue;
    }
    // WCAG 2.5.8 spacing exception: a 24 px circle centred on the target touches no other target.
    const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    let crowded = false;
    for (const other of controls) {
      if (other === el || !visible(other) || other.contains(el) || el.contains(other)) continue;
      const o = other.getBoundingClientRect();
      const dx = Math.max(o.left - cx, 0, cx - o.right), dy = Math.max(o.top - cy, 0, cy - o.bottom);
      if (Math.hypot(dx, dy) < minTarget / 2) { crowded = true; break; }
    }
    if (crowded) out.push(`UX-07 target ${Math.round(b.width)}x${Math.round(b.height)}px too small: ${el.tagName} ${JSON.stringify(name(el))}`);
  }
  // UX-10/UX-18: choices per navigation landmark.
  for (const nav of document.querySelectorAll('nav, [role="navigation"]')) {
    if (!visible(nav)) continue;
    const items = [...nav.querySelectorAll('a[href], button')].filter(visible);
    if (items.length > maxNav) out.push(`UX-10 navigation ${JSON.stringify(nav.getAttribute('aria-label') || '')} shows ${items.length} choices at once`);
  }
  // UX-14/UX-31: text a container cuts off without an ellipsis cannot be read at all.
  for (const box of document.querySelectorAll('body *')) {
    if (!visible(box) || box.scrollWidth <= box.clientWidth + 1) continue;
    const s = getComputedStyle(box);
    if (!['hidden', 'clip', 'auto', 'scroll'].includes(s.overflowX)) continue;
    if (['auto', 'scroll'].includes(s.overflowX) && box.scrollWidth > box.clientWidth) {
      // A scroll container is fine when it says so: chips rows and code scroll on purpose.
      if (box.matches('nav, pre, code, table, [role="tablist"], .ocade-scroll') || box.closest('pre')) continue;
    }
    if (s.textOverflow === 'ellipsis') continue;
    const edge = box.getBoundingClientRect().right + 2;
    const cut = [...box.querySelectorAll('*')].find(child => child.childElementCount === 0
      && (child.textContent || '').trim() && visible(child) && child.getBoundingClientRect().right > edge);
    if (cut) out.push(`UX-14 text cut off: ${JSON.stringify(name(cut))}`);
  }
  // UX-11/UX-31 describe the page, not a dialog opened on top of it.
  if (opened) return out.concat(postelAndStop());
  // UX-11: language, title, a way home.
  if (!document.documentElement.lang) out.push('UX-11 page has no language');
  if (!document.title.trim()) out.push('UX-11 page has no title');
  const home = [...document.querySelectorAll('a[href]')].some(a => {
    const u = new URL(a.href, location.href); return u.origin === location.origin && u.pathname === '/';
  });
  if (!home && location.pathname !== '/') out.push('UX-11 no link back to the home page');
  // UX-31: one h1; no skipped heading levels.
  const headings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter(visible);
  const h1 = headings.filter(h => h.tagName === 'H1').length;
  if (h1 !== 1) out.push(`UX-31 ${h1} visible level-1 headings (want 1)`);
  let last = 0;
  for (const h of headings) {
    const level = Number(h.tagName[1]);
    if (last && level > last + 1) out.push(`UX-31 heading jumps from h${last} to h${level}: ${JSON.stringify(name(h))}`);
    last = level;
  }
  return out.concat(postelAndStop());
  function postelAndStop() {
  const out = [];
  // UX-24: fields that hold an email or a password say so.
  for (const input of document.querySelectorAll('input')) {
    if (!visible(input)) continue;
    const hint = `${input.name} ${input.id} ${input.getAttribute('aria-label') || ''} ${input.placeholder}`.toLowerCase();
    if (/e-?mail/.test(hint) && input.type !== 'email' && !/email/.test(input.autocomplete))
      out.push(`UX-24 email field without type=email or autocomplete: ${JSON.stringify(name(input))}`);
    if (input.type === 'password' && !input.getAttribute('autocomplete'))
      out.push(`UX-24 password field without autocomplete: ${JSON.stringify(name(input))}`);
  }
  // UX-28: STOP is visually distinct from every other button.
  const buttons = [...document.querySelectorAll('button')].filter(visible);
  const paint = el => { const s = getComputedStyle(el); return `${s.backgroundColor}|${s.color}|${s.borderColor}`; };
  for (const stop of buttons.filter(b => /^stop\\b/i.test(name(b)))) {
    const same = buttons.filter(b => b !== stop && !/^stop\\b/i.test(name(b)) && paint(b) === paint(stop));
    if (same.length) out.push(`UX-28 STOP looks like ${JSON.stringify(name(same[0]))}`);
  }
  // UX-04: a pre-checked consent or marketing box is a misleading default.
  for (const box of document.querySelectorAll('input[type=checkbox]')) {
    if (!visible(box) || !box.defaultChecked) continue;
    const label = (box.labels && box.labels[0] ? box.labels[0].textContent : name(box)) || '';
    if (/consent|agree|marketing|newsletter|updates|share|promotion/i.test(label))
      out.push(`UX-04 pre-checked consent box: ${JSON.stringify(label.trim().slice(0, 60))}`);
  }
  // UX-05: one form with too many visible fields is too much to hold at once.
  for (const form of document.querySelectorAll('form')) {
    const fields = [...form.querySelectorAll('input, select, textarea')]
      .filter(f => visible(f) && !['hidden', 'submit', 'button', 'checkbox', 'radio'].includes(f.type));
    if (fields.length > maxFields) out.push(`UX-05 form shows ${fields.length} fields at once (max ${maxFields})`);
  }
  // UX-34: a field marked invalid must point to visible text that says what is wrong.
  for (const field of document.querySelectorAll('[aria-invalid="true"]')) {
    if (!visible(field)) continue;
    const ids = `${field.getAttribute('aria-describedby') || ''} ${field.getAttribute('aria-errormessage') || ''}`.split(/\\s+/).filter(Boolean);
    const said = ids.some(id => { const t = document.getElementById(id); return t && t.textContent.trim() && visible(t); });
    if (!said) out.push(`UX-34 invalid field gives no reason: ${JSON.stringify(name(field))}`);
  }
  // UX-13 Proximity: a field's label and its stated reason sit next to it, not across the page.
  const gap = (a, b) => Math.hypot(Math.max(0, a.left - b.right, b.left - a.right), Math.max(0, a.top - b.bottom, b.top - a.bottom));
  for (const field of document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea')) {
    if (!visible(field)) continue;
    const fieldBox = field.getBoundingClientRect();
    const near = [...(field.labels || [])].filter(visible);
    for (const id of `${field.getAttribute('aria-describedby') || ''}`.split(/\\s+/).filter(Boolean)) {
      const t = document.getElementById(id);
      if (t && visible(t) && field.getAttribute('aria-invalid') === 'true') near.push(t);
    }
    for (const t of near) {
      const d = gap(fieldBox, t.getBoundingClientRect());
      if (d > maxGap) out.push(`UX-13 ${Math.round(d)}px between a field and its label or reason: ${JSON.stringify(name(field))}`);
    }
  }
  // UX-12 Common Region: choices of one radio group share a named group boundary.
  const groups = new Map();
  for (const radio of document.querySelectorAll('input[type=radio]')) {
    if (!visible(radio) || !radio.name) continue;
    const key = (radio.form ? 'f' : '') + radio.name;
    groups.set(key, [...(groups.get(key) || []), radio]);
  }
  for (const radios of groups.values()) {
    if (radios.length < 2) continue;
    const g = radios[0].closest('fieldset, [role=radiogroup], [role=group]');
    const named = g && (g.getAttribute('aria-label') || g.getAttribute('aria-labelledby') || (g.querySelector('legend') || {}).textContent);
    if (!named || !radios.every(r => g.contains(r))) out.push(`UX-12 radio group ${JSON.stringify(radios[0].name)} has no named boundary around all its choices`);
  }
  // UX-15 Similarity: buttons with one name on one page look alike.
  const looks = new Map();
  for (const b of document.querySelectorAll('button, [role=button], input[type=submit]')) {
    if (!visible(b) || !b.textContent.trim()) continue;
    const s = getComputedStyle(b);
    const key = name(b), look = [s.fontSize, s.fontWeight, s.borderRadius, s.backgroundColor, s.color].join('|');
    if (looks.has(key) && looks.get(key) !== look) out.push(`UX-15 two buttons named ${JSON.stringify(key)} look different`);
    looks.set(key, look);
  }
  // UX-15 Similarity (consistent identification): one link name never leads to two different pages.
  const targets = new Map();
  for (const a of document.querySelectorAll('a[href]')) {
    const label = (a.getAttribute('aria-label') || a.textContent).trim().replace(/\\s+/g, ' ').toLowerCase();
    if (!visible(a) || !label) continue;
    const raw = a.getAttribute('href');
    let path = raw;
    try { path = new URL(raw, location.href).pathname; } catch { /* a href the browser cannot resolve stays as written */ }
    targets.set(label, new Set([...(targets.get(label) || []), path]));
  }
  for (const [label, paths] of targets)
    if (paths.size > 1) out.push(`UX-15 link ${JSON.stringify(label)} leads to ${paths.size} different pages`);
  // UX-03 Chunking: controls the page body shows outside any named group, list or table.
  const body = document.querySelector('main') || document.body;
  const chunk = 'fieldset, [role=group], [role=region], [role=tabpanel], [role=radiogroup], [role=toolbar], ul, ol, table, details, form[aria-label], section[aria-label], section[aria-labelledby], article';
  const loose = [...body.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=switch]')]
    .filter(el => visible(el) && !el.closest('nav, header, footer, dialog, [role=dialog]') && !el.parentElement.closest(chunk));
  if (loose.length > maxUngrouped) out.push(`UX-03 ${loose.length} controls outside any named group (max ${maxUngrouped}): ${JSON.stringify(name(loose[0]))}...`);
  // UX-02 Choice Overload: one dialog, or one ungrouped list of options, never asks for too many decisions.
  for (const d of document.querySelectorAll('dialog[open], [role=dialog], [role=alertdialog]')) {
    // Buttons inside a navigation landmark or tab list are destinations (UX-10 counts them), not decisions.
    // A switch or a pressed/unpressed choice is a state the person sets, and the dialog's own close control
    // dismisses it: neither is another decision to take.
    const n = [...d.querySelectorAll('button, [role=button]')].filter(b => visible(b) && !b.closest('nav, [role=tablist]')
      && b.getAttribute('role') !== 'switch' && !b.hasAttribute('aria-pressed') && !/^close\\b/i.test(name(b))).length;
    if (visible(d) && n > 4) out.push(`UX-02 dialog ${JSON.stringify(name(d))} offers ${n} buttons (max 4)`);
  }
  for (const sel of document.querySelectorAll('select:not([multiple])'))
    if (visible(sel) && !sel.querySelector('optgroup') && sel.options.length > 15)
      out.push(`UX-02 select ${JSON.stringify(name(sel))} lists ${sel.options.length} ungrouped options (max 15)`);
  // UX-26 Serial Position: in a dialog with three or more choices, the way out sits first or last, never lost in the middle.
  for (const d of document.querySelectorAll('dialog[open], [role=dialog], [role=alertdialog]')) {
    if (!visible(d)) continue;
    const btns = [...d.querySelectorAll('button, [role=button]')].filter(b => visible(b) && !b.closest('nav, [role=tablist]'));
    btns.forEach((b, i) => {
      if (btns.length >= 3 && i > 0 && i < btns.length - 1 && /^(cancel|close|dismiss|no thanks|not now)\\b/i.test(name(b)))
        out.push(`UX-26 ${JSON.stringify(name(b))} is buried at position ${i + 1} of ${btns.length} in dialog ${JSON.stringify(name(d))}`);
    });
  }
  // UX-32 Progressive Disclosure: advanced controls start folded; a newcomer opens them on purpose.
  if (!opened)
    for (const d of document.querySelectorAll('details[open]')) {
      const head = d.querySelector('summary');
      if (head && visible(d) && /advanced|developer|expert/i.test(head.textContent))
        out.push(`UX-32 ${JSON.stringify(name(head))} is open on first view`);
    }
  // UX-19 Occam's Razor: one container never repeats a control with the same name (a duplicate adds a choice, not a capability).
  for (const group of new Set([...document.querySelectorAll('button, [role=button], a[href]')].map(el => el.parentElement))) {
    if (!group || group.closest('nav, footer')) continue;
    const seen = new Set();
    for (const el of group.children) {
      if (!el.matches('button, [role=button], a[href]') || !visible(el)) continue;
      const key = name(el).toLowerCase();
      if (key && seen.has(key)) out.push(`UX-19 duplicate control ${JSON.stringify(key)} beside its twin`);
      seen.add(key);
    }
  }
  // UX-01 Aesthetic-Usability: a coherent look uses few type families; many families read as clutter.
  const families = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    families.add(getComputedStyle(el).fontFamily.split(',')[0].trim().replace(/['"]/g, '').toLowerCase());
  }
  families.delete('monospace');
  if (families.size > 3) out.push(`UX-01 ${families.size} type families on one page (max 3): ${[...families].join(', ')}`);
  // UX-09 Goal-Gradient: a progress bar either states its true value or says it cannot know.
  for (const bar of document.querySelectorAll('progress, [role=progressbar]')) {
    if (!visible(bar)) continue;
    const known = bar.tagName === 'PROGRESS' ? bar.hasAttribute('value') : bar.hasAttribute('aria-valuenow');
    const label = bar.getAttribute('aria-label') || bar.getAttribute('aria-labelledby') || (bar.labels && bar.labels.length);
    if (!label) out.push('UX-09 progress bar without a name');
    if (known && !(Number(bar.getAttribute('aria-valuenow') ?? bar.getAttribute('value')) >= 0)) out.push('UX-09 progress bar with an invalid value');
  }
  return out;
  }
}"""

READY = "() => { const n = performance.getEntriesByType('navigation')[0]; return n ? n.domContentLoadedEventEnd : 0; }"
FIRST_LOAD = """() => {
  const out = [];
  for (const d of document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"]')) {
    const b = d.getBoundingClientRect(), s = getComputedStyle(d);
    if (s.display !== 'none' && s.visibility !== 'hidden' && b.width > 0 && b.height > 0)
      out.push('UX-20 dialog open on first load: ' + (d.getAttribute('aria-label') || d.textContent.trim().slice(0, 40)));
  }
  for (const m of document.querySelectorAll('audio, video'))
    if (!m.paused && !m.muted && m.volume > 0) out.push('UX-25 media plays sound on its own: ' + m.tagName);
  return out;
}"""
LONG_MOTION = """() => document.getAnimations().filter(a => {
  const t = a.effect && a.effect.getComputedTiming(); return a.playState === 'running' && t && t.duration > 10;
}).map(a => (a.animationName || a.transitionProperty || 'animation') + ' on ' + (a.effect.target && a.effect.target.tagName))"""


def measure_args(opened: bool) -> dict:
    return {"minTarget": MIN_TARGET, "maxNav": MAX_NAV_CHOICES, "maxFields": MAX_FORM_FIELDS,
            "maxGap": MAX_LABEL_GAP, "maxUngrouped": MAX_UNGROUPED, "opened": opened}


def audit_page(page, url: str) -> list[str]:
    response = surface_audit.open_page(page, url)
    if response and not (response.headers.get("content-type") or "").startswith("text/html"):
        return []
    problems = page.evaluate(MEASURE, measure_args(False))
    problems += page.evaluate(FIRST_LOAD)
    ready = page.evaluate(READY)
    if ready > READY_MS:
        problems.append(f"UX-06 document ready after {round(ready)} ms (want <= {READY_MS})")
    moving = page.evaluate(LONG_MOTION)
    if moving:
        problems.append(f"UX-08 animates under reduced motion: {sorted(set(moving))[:3]}")
    return problems


def opened_views(page, url: str) -> list[str]:
    """The same checks on what each dialog, menu and disclosure shows when opened (Settings, the
    account menu, Skills...), one at a time, as accessibility_audit.opened_views does for axe."""
    problems = []
    named = re.compile(r"^(Settings|Skills|Scheduled|Files|Conversations|LifeOS|Open Devices|Expand)$")

    def openers():
        found = page.locator(accessibility_audit.OPENERS)
        by_name = page.get_by_role("button", name=named)
        return [found.nth(i) for i in range(found.count())] + [by_name.nth(i) for i in range(by_name.count())]

    for index in range(min(len(openers()), 16)):
        page.goto(url, wait_until="networkidle")
        found = openers()
        if index >= len(found):
            break
        try:
            if not found[index].is_visible():
                continue
            label = (found[index].get_attribute("aria-label") or found[index].inner_text() or "").strip()[:40]
            found[index].click(timeout=3000)
            page.wait_for_timeout(300)
        except Exception:  # noqa: BLE001, S112 - an unpressable control is the surface audit's finding
            continue
        for problem in page.evaluate(MEASURE, measure_args(True)):
            problems.append(f"after opening {label!r}: {problem}")
        page.keyboard.press("Escape")
    return problems


def settings_categories(page, url: str) -> list[str]:
    """Each of the six Settings categories, opened by its address (`?settings=<category>`)."""
    problems = []
    for category in ("account", "preferences", "devices", "privacy", "billing", "byok"):
        page.goto(f"{url}?settings={category}", wait_until="networkidle")
        if not page.get_by_role("dialog", name="Settings", exact=True).is_visible():
            problems.append(f"Settings > {category} did not open")
            continue
        for problem in page.evaluate(MEASURE, measure_args(True)):
            problems.append(f"Settings > {category}: {problem}")
    return problems


def main(base: str, session: str | None, storage_key: str | None, engine: str) -> int:
    origin = surface_audit.site_origin(base)
    if session and os.environ.get("OCADE_AUDIT_SESSION_ORIGIN") != origin:
        raise ValueError("set the exact disposable audit origin before loading a synthetic session")
    login = surface_audit.session_script(origin, storage_key, Path(session).read_text(encoding="utf-8")) \
        if session else None
    report: dict[str, list[str]] = {}
    pages: list[str] = []
    with sync_playwright() as playwright:
        browser = surface_audit.launch_audit_browser(playwright, engine)
        for profile, options in surface_audit.browser_profiles(playwright, engine):
            context = browser.new_context(**options, reduced_motion="reduce")
            page = context.new_page()
            if login:
                page.add_init_script(login)
            queue = [origin + path for path in ("/", "/library", "/ocade-jarvis")]
            seen: set[str] = set()
            while queue and len(seen) < 80:
                url = queue.pop(0)
                if url in seen:
                    continue
                seen.add(url)
                try:
                    problems = audit_page(page, url)
                    queue.extend(link for link in accessibility_audit.links(page, origin) if link not in seen)
                    problems += opened_views(page, url)
                    if login and urlsplit(url).path == "/":
                        problems += settings_categories(page, url)
                except Exception as error:  # noqa: BLE001 - a page that cannot be audited is a finding
                    problems = [f"could not audit: {str(error)[:200]}"]
                pages.append(f"{profile} {urlsplit(page.url).path}")
                if problems:
                    report[f"{profile} {urlsplit(url).path}"] = problems
            context.close()
        browser.close()
    print(json.dumps({"engine": engine, "signedIn": bool(login), "pages": pages,
                      "pagesWithProblems": len(report),
                      "problems": report}, indent=2))
    return 1 if report else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base")
    parser.add_argument("session", nargs="?")
    parser.add_argument("storage_key", nargs="?")
    parser.add_argument("--engine", choices=surface_audit.ENGINES, default="chromium")
    sys.exit(main(**vars(parser.parse_args())))
