"""A frozen multi-tab order site for the browser task: data on one tab, a dynamic form on
another, an upload, a server-side submission count and a downloadable receipt."""
import http.server
import json
import threading
from urllib.parse import parse_qs, urlparse

ORDERS = [("Rocket fuel", 3, 120.0), ("Heat shield", 2, 450.0), ("Guidance chip", 4, 75.5)]

INDEX = """<title>Orders</title><main><h1>Order 7731</h1>
<table><tr><th>Item</th><th>Qty</th><th>Unit price</th></tr>{rows}</table>
<p>Customer: Ada Lovelace</p>
<a href="/form.html" target="_blank">Open order form</a></main>"""

FORM = """<title>Order form</title><main><h1>Submit order</h1>
<label>Customer <input id="customer"></label>
<label>Plan <select id="plan"><option value="">Choose</option><option>Standard</option>
<option>Express</option></select></label>
<div id="more" hidden><label>Order total <input id="total"></label>
<label>Attachment <input type="file" id="file"></label></div>
<button id="send" disabled>Send order</button><p id="status"></p></main>
<script>
const plan = document.getElementById('plan'), more = document.getElementById('more'),
  send = document.getElementById('send');
plan.addEventListener('change', () => setTimeout(() => { more.hidden = !plan.value;
  send.disabled = !plan.value; }, 600));
send.addEventListener('click', async () => {
  const file = document.getElementById('file').files[0];
  const body = JSON.stringify({customer: document.getElementById('customer').value,
    plan: plan.value, total: document.getElementById('total').value,
    file: file ? file.name + ':' + (await file.text()) : ''});
  const r = await fetch('/submit', {method: 'POST', body});
  const out = await r.json();
  document.getElementById('status').innerHTML = out.ok
    ? 'Received. <a href="/receipt?id=' + out.id + '">Download receipt</a>' : 'Refused: ' + out.error;
});
</script>"""


class Site:
    def __init__(self):
        self.submissions: list[dict] = []
        site = self

        class Handler(http.server.BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def _send(self, body: str, kind="text/html", extra=()):
                data = body.encode()
                self.send_response(200)
                self.send_header("Content-Type", kind)
                for k, v in extra:
                    self.send_header(k, v)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def do_GET(self):
                url = urlparse(self.path)
                if url.path in ("/", "/index.html"):
                    rows = "".join(f"<tr><td>{n}</td><td>{q}</td><td>{p:.2f}</td></tr>" for n, q, p in ORDERS)
                    return self._send(INDEX.format(rows=rows))
                if url.path == "/form.html":
                    return self._send(FORM)
                if url.path == "/receipt":
                    i = int(parse_qs(url.query)["id"][0])
                    s = site.submissions[i]
                    return self._send(f"Receipt {i}\ncustomer={s['customer']}\nplan={s['plan']}\ntotal={s['total']}\n",
                                      "text/plain", [("Content-Disposition", f'attachment; filename="receipt-{i}.txt"')])
                self.send_error(404)

            def do_POST(self):
                data = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                ok = bool(data.get("customer") and data.get("plan") and data.get("total") and data.get("file"))
                if ok:
                    site.submissions.append(data)
                self._send(json.dumps({"ok": ok, "id": len(site.submissions) - 1,
                                       "error": "" if ok else "missing field"}), "application/json")

        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}"

    @staticmethod
    def expected_total() -> str:
        return f"{sum(q * p for _, q, p in ORDERS):.2f}"

    def close(self):
        self.server.shutdown()
