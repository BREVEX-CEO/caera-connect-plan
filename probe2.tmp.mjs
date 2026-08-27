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
await page.goto("http://127.0.0.1:8080/ocade",{waitUntil:"domcontentloaded"}); await page.waitForTimeout(3000); await clearModals();
console.log("== composer area buttons ==");
console.log(JSON.stringify(await page.evaluate(()=>{
 const c=document.querySelector("#ocade-chat-composer"); const box=c?.closest("form,div[class*=border]")?.parentElement||document.body;
 return [...box.querySelectorAll("button")].map(e=>({t:e.getAttribute("title"),a:e.getAttribute("aria-label"),x:e.textContent.trim().slice(0,30)}));
}),null,1));
console.log("== account menu ==");
await page.locator('button[aria-label="Account menu"]').first().click().catch(e=>console.log("click fail",e.message));
await page.waitForTimeout(1200);
console.log(JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('[role=menu],[role=menuitem],[data-radix-popper-content-wrapper]')].map(e=>e.textContent.trim().slice(0,200))),null,1));
console.log("== projects create ==");
await page.goto("http://127.0.0.1:8080/ocade/projects",{waitUntil:"domcontentloaded"}); await page.waitForTimeout(2500); await clearModals();
page.on("console",m=>{if(m.type()==="error")console.log("  [err]",m.text().slice(0,180));});
await page.fill('input[placeholder="New project name"]',"Project probe-xyz");
await page.locator("button",{hasText:/^Create project$/}).first().click();
await page.waitForTimeout(3000);
console.log("after create, contains probe-xyz:", (await page.evaluate(()=>document.body.innerText)).includes("probe-xyz"));
console.log("toasts:", await page.evaluate(()=>[...document.querySelectorAll('[data-sonner-toast],[role=status]')].map(e=>e.textContent.trim().slice(0,160))));
await page.reload({waitUntil:"domcontentloaded"}); await page.waitForTimeout(3000);
console.log("after reload, contains probe-xyz:", (await page.evaluate(()=>document.body.innerText)).includes("probe-xyz"));
console.log("body:", (await page.evaluate(()=>document.body.innerText)).slice(0,700).replace(/\n+/g," | "));
await b.close();
