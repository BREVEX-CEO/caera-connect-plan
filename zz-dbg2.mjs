import { createServer } from "node:http";
import { chromium } from "playwright-core";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os"; import { join, resolve } from "node:path";
const server = createServer((q,s)=>{s.writeHead(200,{"content-type":"text/html"});s.end("<title>T</title><h1>hi</h1>");});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(join(tmpdir(),"dbg2-"));
const ctx = await chromium.launchPersistentContext(profile,{executablePath:"/opt/pw-browsers/chromium",
  args:["--no-sandbox","--headless=new",`--disable-extensions-except=${resolve("extension")}`,`--load-extension=${resolve("extension")}`]});
let w = ctx.serviceWorkers()[0] || await ctx.waitForEvent("serviceworker",{timeout:20000});
const ID = w.url().split("/")[2];
const site = await ctx.newPage(); await site.goto(ORIGIN+"/");
const popup = await ctx.newPage();
popup.on("console", m => console.log("POPUP LOG:", m.text()));
popup.on("pageerror", e => console.log("POPUP ERR:", e.message));
await popup.goto(`chrome-extension://${ID}/src/popup.html`);
// what does targetTab resolve to?
console.log("tabs:", await popup.evaluate(async()=> (await chrome.tabs.query({})).map(t=>t.url)));
const res = await popup.evaluate(async (origin) => {
  try { const g = await chrome.permissions.request({origins:[origin+"/*"]}); return {granted:g}; }
  catch(e){ return {error:String(e)}; }
}, ORIGIN);
console.log("permissions.request (no gesture):", JSON.stringify(res));
await popup.click("#approve");
await popup.waitForTimeout(1500);
console.log("origins html:", await popup.evaluate(()=>document.getElementById("origins").innerText));
console.log("contains:", await popup.evaluate(async(o)=>chrome.permissions.contains({origins:[o+"/*"]}), ORIGIN));
await ctx.close(); server.close(); await rm(profile,{recursive:true,force:true});
