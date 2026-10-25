"""The frozen order site (experiments/architectures/fixtures/order_site.py) for one run.

python3 shop.py <record.json>: prints its URL, then keeps the site's own submission record in
<record.json> until killed, for the oracle.
"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "architectures" / "fixtures"))
from order_site import Site  # noqa: E402

site = Site()
print(site.url, flush=True)
while True:
    Path(sys.argv[1]).write_text(json.dumps({"url": site.url, "submissions": site.submissions}))
    time.sleep(0.5)
