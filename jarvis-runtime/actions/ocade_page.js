/*
 * OCADE page semantics — the ONE authority for how JARVIS reads a web page.
 *
 * Loaded by the Device Agent (actions/browser_control.py, through Playwright)
 * into JARVIS's own browser and into the person's own Chrome alike, so both
 * see the same elements, names, refs, geometry and human-verification
 * boundaries.
 * Idempotent: running it again on the same document changes nothing.
 */
(() => {
  if (window.__ocade) return;
    window.__ocadeMutations = 0;
    const start = () => new MutationObserver((records) => {
      if (records.some((r) => r.attributeName !== 'data-ocade-ref')) window.__ocadeMutations++;
    }).observe(document.documentElement, {subtree: true, childList: true, attributes: true, characterData: true});
    if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start);
  const roleOf = (el) => el.getAttribute('role') || ({A: 'link', BUTTON: 'button', SELECT: 'combobox',
    TEXTAREA: 'textbox', SUMMARY: 'button', CANVAS: 'canvas'})[el.tagName] || (el.tagName === 'INPUT'
    ? (({checkbox: 'checkbox', radio: 'radio', submit: 'button', button: 'button', reset: 'button',
        search: 'searchbox', range: 'slider'})[el.type] || 'textbox') : (el.isContentEditable ? 'textbox' : 'generic'));
  // A picker's preview (a canvas above its caption) is named by that caption.
  const captionOf = (el) => {
    const box = el.parentElement;
    if (!box || box === document.body || box.children.length > 2) return '';
    const text = (box.innerText || '').trim();
    return /[\p{L}\p{N}]/u.test(text) && text.length <= 40 ? text : '';
  };
  // A control whose visible label sits just before it, unassociated ("Fill color: [swatch]").
  const nearLabel = (el) => {
    for (let node = el, depth = 0; node && depth < 3; node = node.parentElement, depth++) {
      const before = node.previousElementSibling;
      if (before && before.tagName === 'LABEL' && !before.htmlFor) return before.innerText;
      // A form laid out as a table: the label is the cell before.
      if (before && ['TH', 'TD'].includes(before.tagName) && before.innerText.trim().length <= 40) {
        return before.innerText;
      }
    }
    return '';
  };
  // A label that wraps its control names it by the label's own words, not the control's
  // (a select's options, a field's value).
  const ownText = (label, el) => {
    if (!label.contains(el)) return label.innerText;
    const copy = label.cloneNode(true);
    copy.querySelectorAll('select, textarea, input, button').forEach((c) => c.remove());
    return copy.textContent;
  };
  const nameOf = (el) => {
    const by = el.getAttribute('aria-labelledby');
    const labelled = by ? by.split(/\s+/).map((id) => document.getElementById(id)?.innerText || '').join(' ') : '';
    const label = el.labels && el.labels[0] ? ownText(el.labels[0], el)
      : ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) ? nearLabel(el) : '';
    const own = el.tagName === 'INPUT' && ['submit', 'button', 'reset'].includes(el.type) ? el.value : '';
    // An icon glyph is not a name: a toolbar button's title says what it does.
    const text = /[\p{L}\p{N}]/u.test(el.innerText || '') ? el.innerText : '';
    return (el.getAttribute('aria-label') || labelled || label || own || text
      || el.getAttribute('placeholder') || el.getAttribute('title') || el.getAttribute('alt')
      || (el.tagName === 'CANVAS' ? captionOf(el) || `canvas ${el.width}x${el.height}` : '') || '')
      .trim().replace(/\s+/g, ' ').slice(0, 80);
  };
  const identityOf = (el) => {
    const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
    return {role: roleOf(el), name: nameOf(el), type: el.type || '',
      editable: ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName),
      password: el.type === 'password' || ac.includes('password'),
      card: ac.startsWith('cc-') || /card.?number|cvv|cvc|security.?code/i.test((el.name || '') + ' ' + (el.id || ''))};
  };
  const submitOf = (el) => {
    const form = el && el.closest ? el.closest('form') : null;
    if (!form) return {name: ''};
    const button = form.querySelector('button[type=submit],button:not([type]),input[type=submit]');
    return {name: button ? nameOf(button) : (form.getAttribute('aria-label') || '')};
  };
  const SELECTOR = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],'
    + '[role=link],[role=checkbox],[role=radio],[role=tab],[role=menuitem],[role=option],[role=switch],'
    + '[role=combobox],[role=searchbox],[role=textbox],[contenteditable=""],[contenteditable=true],'
    // An app's own toolbar (a titled icon that acts when pressed) and its drawing surfaces.
    + '[title],canvas';
  const acts = (el) => el.tagName === 'CANVAS' || roleOf(el) !== 'generic'
    || el.onclick || getComputedStyle(el).cursor === 'pointer';
  // Behind an open dialog or overlay: pressing it now would press what covers it instead.
  // Its own label in front of it (a styled checkbox) is not a cover.
  const covered = (el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1),
      Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1));
    if (!top || el.contains(top) || top.contains(el)
      || (el.labels && [...el.labels].some((l) => l.contains(top)))) return false;
    // What is in front, by its own words (a consent banner, a dialog), so it can be answered.
    let cover = top;
    while (cover.parentElement && cover.parentElement !== document.body && !cover.parentElement.contains(el)) {
      cover = cover.parentElement;
    }
    return (cover.innerText || cover.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 80) || true;
  };
  // How many controls the page has: an app that builds itself after load is ready when this settles.
  const controls = () => document.querySelectorAll(SELECTOR).length;
  const snapshot = () => {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'
      && r.bottom >= 0 && r.right >= 0 && r.top <= innerHeight && r.left <= innerWidth;
  };
  let seq = window.__ocadeRefSeq || 0;
  const elements = [];
  for (const el of document.querySelectorAll(SELECTOR)) {
    if (elements.length >= 150) break;
    if (!visible(el) || !acts(el)) continue;
    let ref = el.getAttribute('data-ocade-ref');
    if (!ref) { ref = 'e' + (++seq); el.setAttribute('data-ocade-ref', ref); }
    const id = identityOf(el);
    const item = {ref, role: id.role, name: id.name};
    if (id.editable) {
      item.value = id.password ? (el.value ? '(hidden)' : '') : String(el.value || '').slice(0, 80);
      if (el.type) item.type = el.type;
    }
    if (el.disabled) item.disabled = true;
    if (covered(el)) item.covered = true;
    if (el.checked) item.checked = true;
    if (el.getAttribute('aria-pressed') === 'true') item.pressed = true;
    elements.push(item);
  }
  window.__ocadeRefSeq = seq;
  // The page's own main content when it marks one: on long pages the first lines of the body are
  // navigation, and what the person came for was past the part a look carries.
  const main = document.querySelector('main, [role=main], article') || document.body;
  const text = (main ? main.innerText : '').replace(/\n{3,}/g, '\n\n');
  const q = (s) => !!document.querySelector(s);
  let boundary = null;
  if (q('iframe[src*="recaptcha"],iframe[src*="hcaptcha"],iframe[src*="challenges.cloudflare.com"],'
      + '.g-recaptcha,.h-captcha,.cf-turnstile') || /verify (that )?you are (a )?human|i.?m not a robot|confirm you.{0,3}re not a bot|verif(y|ies) you are not a bot|performing security verification/i.test(text)) {
    boundary = 'captcha';
  } else if (q('input[autocomplete="one-time-code"],input[name*="otp" i],input[id*="otp" i],'
      + 'input[name*="totp" i],input[name*="2fa" i],input[name*="mfa" i]')) {
    boundary = 'otp';
  // Asked for, not merely offered: a "Use a passkey" sign-in option on a page that needs no
  // sign-in is not a boundary.
  } else if (/(sign in|log in|continue|verify) with (a |your )?passkey|use your (passkey|security key)|use your (phone|device) to sign in/i.test(text)) {
    boundary = 'passkey';
  } else if (q('input[type=password]')) {
    boundary = 'password';
  }
  // The page's labelled values (table rows with a heading cell, definition lists), in order:
  // a fact box or spec sheet read once, where its first lines of text rarely reach the figure.
  const clean = (el) => (el ? el.innerText : '').replace(/\s+/g, ' ').trim();
  const facts = [];
  let size = 0;
  for (const row of document.querySelectorAll('tr, dt')) {
    let line = '';
    if (row.tagName === 'DT') {
      line = clean(row).slice(0, 60) + ': ' + clean(row.nextElementSibling).slice(0, 100);
    } else {
      const label = row.querySelector('th');
      if (!label) continue;
      const value = [...row.children].filter((cell) => cell !== label).map(clean).join(' ').trim();
      line = clean(label).slice(0, 60) + (value ? ': ' + value.slice(0, 100) : '');
    }
    if (line.length < 3 || size + line.length > 1500) break;
    facts.push(line);
    size += line.length + 1;
  }
  return {elements, text: text.slice(0, 3000), facts: facts.join('\n'), boundary};
  };
  const geometry = () => ({w: innerWidth, h: innerHeight, dpr: devicePixelRatio,
  zoom: window.visualViewport ? visualViewport.scale : 1, sx: Math.round(scrollX),
  sy: Math.round(scrollY), m: window.__ocadeMutations || 0});
  const atPoint = (x, y) => {
  const el = document.elementFromPoint(x, y);
  // The page itself under the point is nothing pressed: its whole text is not a button's name.
  if (!el || el === document.body || el === document.documentElement) return {name: ''};
  return identityOf(el.closest('a,button,input,select,textarea,[role]') || el);
  };
  const byRef = (ref) => document.querySelector(`[data-ocade-ref="${ref}"]`);
  // Like Ctrl+F over the whole page: each place the words appear, with the text around it.
  const findText = (q) => {
    const all = (document.body ? document.body.innerText : '').replace(/\s+/g, ' ');
    const lower = all.toLowerCase();
    const needle = String(q).toLowerCase();
    const found = [];
    for (let at = lower.indexOf(needle); needle && at >= 0 && found.length < 8;
         at = lower.indexOf(needle, at + 300)) {
      found.push(all.slice(Math.max(0, at - 150), at + needle.length + 150));
    }
    return found;
  };
  // A page's video or audio through its own media API: play, pause, seek, and its captions.
  const media = async (op, seconds, ref) => {
    const el = ref ? byRef(ref) : document.querySelector('video, audio');
    if (!(el instanceof HTMLMediaElement)) return {error: 'There is no video or audio here'};
    // Just opened, it may not know its length yet, and a seek before that is dropped: load it.
    if (el.readyState < 1) {
      const known = new Promise((done) => {
        el.addEventListener('loadedmetadata', done, {once: true});
        setTimeout(done, 8000);
      });
      if (el.networkState === HTMLMediaElement.NETWORK_EMPTY || el.preload === 'none') {
        el.preload = 'metadata';
        el.load();
      }
      await known;
    }
    let problem = null;
    if (op === 'play') {
      // A video that cannot load never settles play(): said after a while, never a hung step.
      problem = await Promise.race([
        el.play().then(() => null, (e) => 'It did not play: ' + e.name),
        new Promise((done) => setTimeout(() => done('It has not started playing: the media is still loading'), 10000)),
      ]);
    }
    if (op === 'pause') el.pause();
    if (op === 'seek') {
      const sought = new Promise((done) => {
        el.addEventListener('seeked', done, {once: true});
        setTimeout(done, 5000);
      });
      const target = Math.max(0, Math.min(Number(seconds) || 0, el.duration || Infinity));
      el.currentTime = target;
      await sought;
      // Said when it did not land (a site that does not let its media be moved), never "done at 0 s".
      if (Math.abs(el.currentTime - target) > 0.5) {
        problem = 'This media did not move to ' + target + ' s (it is at ' + el.currentTime.toFixed(1) + ' s)';
      }
    }
    const tracks = [...el.textTracks].filter((t) => /captions|subtitles/.test(t.kind));
    // The caption files the page declares, this media's own first. A player that rebuilds its
    // video (Wikimedia Commons' does) leaves it no loaded track: the declared file is read instead.
    const files = [...el.querySelectorAll('track[src]'), ...document.querySelectorAll('track[src]')]
      .filter((t) => /captions|subtitles/.test(t.kind));
    let captions;
    if (op === 'captions') {
      const track = tracks.find((t) => /^en/i.test(t.language)) || tracks[0];
      const file = files.find((t) => /^en/i.test(t.srclang)) || files[0];
      if (!track && !file) return {error: 'This video has no captions to read'};
      if (track) {
        if (track.mode === 'disabled') track.mode = 'hidden';
        for (let waited = 0; (!track.cues || !track.cues.length) && waited < 5000; waited += 200) {
          await new Promise((done) => setTimeout(done, 200));
        }
        captions = [...(track.cues || [])].map((c) => c.startTime.toFixed(1) + 's ' + c.text.replace(/\s+/g, ' '))
          .join('\n').slice(0, 8000);
      }
      let refused = '';
      if (!captions && file) {
        const text = await fetch(file.src).then((r) => {
          if (!r.ok) refused = ' (the site answered ' + r.status + ')';
          return r.ok ? r.text() : '';
        }).catch(() => '');
        const at = (stamp) => stamp.replace(',', '.').split(':').reduce((sum, part) => sum * 60 + Number(part), 0);
        captions = text.split(/\r?\n\r?\n/).map((block) => {
          const cue = /([\d:.,]+)\s*-->[^\n]*\n([\s\S]+)/.exec(block);
          return cue && at(cue[1]).toFixed(1) + 's ' + cue[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        }).filter(Boolean).join('\n').slice(0, 8000);
      }
      // Empty is not read: never "done" with nothing in it.
      if (!captions) return {error: "This video's captions could not be read" + refused};
    }
    return {currentTime: Math.round(el.currentTime * 10) / 10, duration: Math.round(el.duration * 10) / 10 || null,
      paused: el.paused, muted: el.muted, captionLanguages: tracks.length ? tracks.map((t) => t.language || t.label)
        : [...new Set(files.map((t) => t.srclang || t.label))],
      ...(captions === undefined ? {} : {captions}), ...(problem ? {error: problem} : {})};
  };
  window.__ocade = { snapshot, controls, covered, geometry, identityOf, submitOf, atPoint, byRef, findText, media };
})();
