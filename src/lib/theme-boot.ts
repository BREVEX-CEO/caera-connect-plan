/*
 * THE FIRST PAINT IS A THEME DECISION, AND REACT IS TOO LATE TO MAKE IT.
 *
 * `AppearanceProvider` puts the classes on <html> in an effect, so until React
 * hydrates the document has no theme at all and the browser paints its own
 * white canvas. On a near-black product that white frame reads as the page
 * having failed and reloaded.
 *
 * Synchronous, inline, in <head>, before anything renders — a module cannot do
 * it, because modules are deferred by definition. It reads the same key and
 * the same shape as `readLocal()` in `src/lib/appearance.tsx`, and if anything
 * goes wrong it does nothing and leaves the default dark in place.
 */
export const THEME_BOOT = `(function(){try{
var d=document.documentElement;var light=false;var hc=false;var rm=false;var ts="";
try{var raw=localStorage.getItem("ocade:appearance:v1");
if(raw){var p=JSON.parse(raw);light=p&&(p.theme==="light"||(p.theme==="system"&&matchMedia("(prefers-color-scheme: light)").matches));hc=!!(p&&p.highContrast);rm=!!(p&&p.reducedMotion);ts=p&&(p.textSize==="large"||p.textSize==="larger")?p.textSize:"";}}catch(e){}
if(light)d.classList.add("light");
if(ts)d.classList.add("text-"+ts);
if(hc)d.classList.add("high-contrast");
if(rm)d.classList.add("reduce-motion");
d.style.background=light?"#f1f1f1":"#0a0a0a";
d.style.colorScheme=light?"light":"dark";
}catch(e){}})();`;

/**
 * The CSP hash of THEME_BOOT: the policy allows exactly this inline script and no other
 * fixed one. `tests/security/csp.test.ts` fails if the script changes without this hash.
 */
export const THEME_BOOT_SHA256 = "Pz7NPtSEU58gQgu8enr/BJtxrdGauyw/sECV2Ak2wgg=";
