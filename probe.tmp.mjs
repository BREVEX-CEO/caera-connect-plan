import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium", args:["--no-sandbox"] });
const ctx = await b.newContext(); const page = await ctx.newPage();
async function clearModals(){for(let i=0;i<6;i++){const d=page.locator("[role=dialog],[role=alertdialog]");if(!await d.count())return;const c=d.locator("input[type=checkbox],[role=checkbox]");for(let j=0;j<await c.count();j++)await c.nth(j).click({timeout:3000}).catch(()=>{});const btn=d.getByRole("button",{name:/^(accept and continue|skip|done|finish|got it|close|continue)$/i});if(!await btn.count())return;await btn.first().click({timeout:5000}).catch(()=>{});await page.waitForTimeout(400);}}
await page.goto("http://127.0.0.1:8080/auth",{waitUntil:"domcontentloaded"}); await page.waitForTimeout(1200); await clearModals();
await page.locator("button",{hasText:/^Email$/}).first().click(); await page.waitForTimeout(300);
await page.fill("#email","journey@ocade.test"); await page.fill("#password","AuditPassword123!");
await page.locator("button",{hasText:/^Sign in$/}).first().click(); await page.waitForTimeout(3500); await clearModals();
for(let s=0;s<8;s++){ if(new URL(page.url()).pathname!=="/onboarding")break;
 await page.evaluate(()=>{const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set;document.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([disabled])").forEach(e=>{if(e.value)return;set.call(e,e.type==="email"?"journey@ocade.test":"Journey Tester");e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));});});
 const n=page.locator("button",{hasText:/^(Continue|Next|Finish|Enter workspace)$/i}).first(); if(!await n.count())break; await n.click().catch(()=>{}); await page.waitForTimeout(1400);}
for (const p of process.argv.slice(2)) {
  await page.goto("http://127.0.0.1:8080"+p,{waitUntil:"domcontentloaded"}); await page.waitForTimeout(2200); await clearModals();
  const d = await page.evaluate(()=>({
    url: location.pathname,
    h: [...document.querySelectorAll("h1,h2,h3")].map(e=>e.textContent.trim().slice(0,50)).slice(0,10),
    ctrl: [...document.querySelectorAll("button,input,textarea,select,a[href]")].map(e=>`${e.tagName.toLowerCase()}${e.id?"#"+e.id:""}["${(e.getAttribute("aria-label")||e.getAttribute("title")||e.placeholder||e.textContent||"").trim().slice(0,38)}"]`).slice(0,45),
    txt: document.body.innerText.slice(0,300).replace(/\n+/g," | "),
  }));
  console.log("\n==== "+p+" ====\n"+JSON.stringify(d,null,1));
}
await b.close();
