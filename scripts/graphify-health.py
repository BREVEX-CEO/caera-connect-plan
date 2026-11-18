"""Print node and edge counts for a usable repository graph."""
import json
from pathlib import Path

out = Path("graphify-out")
data = json.loads((out / "graph.json").read_bytes())
nodes = {node["id"] for node in data["nodes"]}
edges = data.get("links", data.get("edges"))
if len(nodes) < 100 or not edges or not (out / "GRAPH_REPORT.md").stat().st_size:
    raise ValueError("incomplete graph or report")
if any(edge[key] not in nodes for edge in edges for key in ("source", "target")):
    raise ValueError("edge references missing node")
print(len(nodes), len(edges))
