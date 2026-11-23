import json, statistics
from playwright.sync_api import sync_playwright
EXE="/opt/pw-browsers/chromium-1243/chrome-linux64/chrome"
out={}
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=EXE)
    for path in ["/","/help","/pricing","/auth","/ocade-jarvis","/privacy"]:
        runs=[]
        for i in range(5):
            ctx=b.new_context(); pg=ctx.new_page()
            cdp=ctx.new_cdp_session(pg); cdp.send("Network.enable")
            total={"b":0}
            cdp.on("Network.loadingFinished", lambda e: total.__setitem__("b", total["b"]+e.get("encodedDataLength",0)))
            pg.add_init_script("window.__lcp=0;new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true})")
            pg.goto("http://127.0.0.1:8787"+path, wait_until="load"); pg.wait_for_timeout(1500)
            nav=pg.evaluate("(()=>{const n=performance.getEntriesByType('navigation')[0];const f=performance.getEntriesByName('first-contentful-paint')[0];return {ttfb:n.responseStart,dcl:n.domContentLoadedEventEnd,load:n.loadEventEnd,fcp:f?f.startTime:null,lcp:window.__lcp,heap:performance.memory?performance.memory.usedJSHeapSize:null}})()")
            nav["bytes"]=total["b"]; runs.append(nav); ctx.close()
        out[path]={k:round(statistics.median([r[k] for r in runs if r[k] is not None]),1) for k in runs[0] if runs[0][k] is not None}
    b.close()
print(json.dumps(out,indent=1))
