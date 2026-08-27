import { chromium } from "playwright-core";
const MARK="q"+Date.now().toString(36); const EMAIL=MARK+"@ocade.test";
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium", args:["--no-sandbox"] });
const ctx = await b.newContext(); const page = await ctx.newPage();
page.on("console",m=>{if(m.type()==="error")console.log("  [console]",m.text().slice(0,220));});
page.on("pageerror",e=>console.log("  [pageerror]",String(e).slice(0,220)));
page.on("request",r=>{ if(/rest\/v1\/(profiles|user_settings)/.test(r.url())) console.log("  [req]",r.method(),r.url().slice(0,110), (r.postData()||"").slice(0,160)); });
page.on("response",async r=>{ if(/rest\/v1\/(profiles|user_settings)/.test(r.url())) console.log("  [res]",r.status(),r.request().method(),r.url().slice(0,90));
 if(r.status()>=400) console.log("  [http]",r.status(),r.request().method(),r.url().slice(0,120), (await r.text().catch(()=>"")).slice(0,200)); });
async function clearModals(){for(let i=0;i<6;i++){const d=page.locator("[role=dialog],[role=alertdialog]");if(!await d.count())return;const c=d.locator("input[type=checkbox],[role=checkbox]");for(let j=0;j<await c.count();j++)await c.nth(j).click({timeout:3000}).catch(()=>{});const btn=d.getByRole("button",{name:/^(accept and continue|skip|done|finish|got it|close|continue)$/i});if(!await btn.count())return;await btn.first().click({timeout:5000}).catch(()=>{});await page.waitForTimeout(400);}}
await page.goto("http://127.0.0.1:8080/auth",{waitUntil:"domcontentloaded"}); await page.waitForTimeout(1500); await clearModals();
await page.locator("button",{hasText:/^Email$/}).first().click(); await page.waitForTimeout(300);
await page.fill("#email",EMAIL); await page.fill("#password","AuditPassword123!");
await page.locator("button",{hasText:/^Sign in$/}).first().click(); await page.waitForTimeout(4000); await clearModals();
for(let s=0;s<10;s++){
 console.log(`\n--- step ${s} @ ${new URL(page.url()).pathname} ---`);
 console.log(await page.evaluate(()=>({
   head:[...document.querySelectorAll("h1,h2,h3")].map(e=>e.textContent.trim().slice(0,70)),
   txt: document.body.innerText.slice(0,500).replace(/\n+/g," | "),
   ctrls:[...document.querySelectorAll("button,input,select,textarea")].map(e=>`${e.tagName.toLowerCase()}${e.type?"["+e.type+"]":""}${e.disabled?"(disabled)":""} "${(e.getAttribute("aria-label")||e.textContent||e.placeholder||"").trim().slice(0,40)}"`),
 })),null,1);
 if(new URL(page.url()).pathname!=="/onboarding") break;
 const ins = page.locator("input:not([type=checkbox]):not([type=radio]):not([disabled])");
 for(let i=0;i<await ins.count();i++){ const el=ins.nth(i); if(await el.inputValue()) continue;
   const ph=(await el.getAttribute("placeholder"))||(await el.getAttribute("aria-label"))||"";
   await el.fill(/mail/i.test(ph)?EMAIL:/language/i.test(ph)?"English":/timezone/i.test(ph)?"UTC":"Journey Tester").catch(()=>{}); }
 const cbs = page.locator("input[type=checkbox]:not([disabled])");
 for(let i=0;i<await cbs.count();i++) await cbs.nth(i).check({timeout:3000}).catch(()=>{});
 await page.waitForTimeout(600);
 const n=page.locator("button",{hasText:/^(Continue|Next|Finish|Enter workspace|Get started|Done)$/i}).first();
 if(!await n.count()){console.log("NO CONTINUE BUTTON");break;}
 if(await n.isDisabled()){console.log("CONTINUE IS DISABLED");break;}
 const label=(await n.textContent()).trim(); console.log("  clicking:",label);
 await n.click().catch(e=>console.log("click err",e.message)); await page.waitForTimeout(3500);
 console.log("  now at:", page.url());
 console.log("  inline error:", await page.evaluate(()=>{const e=[...document.querySelectorAll("[role=alert],.text-destructive")].map(x=>x.textContent.trim().slice(0,160)).filter(Boolean); return e;}));
 const t=await page.evaluate(()=>[...document.querySelectorAll("[data-sonner-toast]")].map(e=>e.textContent.trim().slice(0,200)));
 if(t.length) console.log("  toasts:",JSON.stringify(t));
}

console.log("\n=== PROJECTS ===");
await page.goto("http://127.0.0.1:8080/ocade/projects",{waitUntil:"domcontentloaded"}); await page.waitForTimeout(3500); await clearModals();
console.log((await page.evaluate(()=>document.body.innerText)).slice(0,1100).replace(/\n+/g," | "));
console.log("\n=== SEARCH page ===");
await page.goto("http://127.0.0.1:8080/ocade/search",{waitUntil:"domcontentloaded"}); await page.waitForTimeout(3000);
console.log((await page.evaluate(()=>document.body.innerText)).slice(0,600).replace(/\n+/g," | "));
console.log("inputs:", await page.evaluate(()=>[...document.querySelectorAll("input")].map(e=>e.type+"/"+(e.placeholder||e.getAttribute("aria-label")||""))));
await b.close();
