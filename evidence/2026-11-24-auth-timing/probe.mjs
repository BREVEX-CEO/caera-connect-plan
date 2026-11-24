import { createClient } from "@supabase/supabase-js";
const url="http://127.0.0.1:54321", o={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,o);
const c=()=>createClient(url,process.env.SUPABASE_PUBLISHABLE_KEY,o);
const s=crypto.randomUUID().slice(0,8), email=`t-${s}@example.test`;
await admin.auth.admin.createUser({email,email_confirm:true,password:crypto.randomUUID()});
const t=async(e)=>{const a=performance.now();const r=await c().auth.signInWithPassword({email:e,password:"wrong-pass-123"});return [performance.now()-a, r.error?.status];};
const W=[],U=[];
for(let i=0;i<12;i++){W.push(await t(email));U.push(await t(`n-${s}-${i}@example.test`));}
const med=a=>{const v=a.map(x=>x[0]).sort((x,y)=>x-y);return v[v.length>>1]};
console.log(JSON.stringify({wrong:med(W),unknown:med(U),statuses:[...new Set([...W,...U].map(x=>x[1]))]}));
