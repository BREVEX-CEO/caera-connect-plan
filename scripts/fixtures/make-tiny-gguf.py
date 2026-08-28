"""
Build a VALID, TINY GGUF so real inference can be executed without a download.

WHY THIS EXISTS. Proving the on-device engine needs weights, and no weight host
is reachable from this sandbox — huggingface.co and ollama.com both answer 403
through the proxy. A stub HTTP engine proves the pipeline around the model; it
proves nothing about the model runtime itself. So the weights are constructed
here instead: a real GGUF, correct in every field llama.cpp reads, holding a
one-layer llama over a byte-level vocabulary.

WHAT IT CAN AND CANNOT SHOW. The tensors are random, so the tokens that come
out are meaningless — quality is not testable without trained weights and this
file does not pretend otherwise. What IS real: the runtime loads a real GGUF,
builds a real graph, runs real matrix multiplications, and emits real tokens,
so cold start, warm start and first-token latency are measured rather than
simulated.

Format: GGUF v3 — https://github.com/ggml-org/ggml/blob/master/docs/gguf.md
"""
import math
import random
import sys
from array import array
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gguf_writer as G  # noqa: E402

# A deliberately tiny llama. Big enough to be a real graph, small enough that
# the file is a few hundred kilobytes and the test runs in seconds.
N_EMBD, N_LAYER, N_HEAD, N_FF, N_CTX = 32, 1, 2, 64, 64
N_VOCAB = 3 + 256

# Seeded so the file is byte-identical on every machine and every run: a
# fixture whose bytes drift is a fixture that cannot be hashed or cached.
# Stdlib only, deliberately — this has to run on a bare CI python with no
# `pip install` step in front of it.
rng = random.Random(7)


def tensor(name: str, ne: list[int]) -> tuple[str, list[int], array]:
    # Small values keep the graph numerically sane; the point is that it runs.
    count = math.prod(ne)
    return name, ne, array("f", [rng.gauss(0.0, 1.0) * 0.02 for _ in range(count)])


# ne is in ggml order: ne[0] is the fastest-moving axis. For a weight that maps
# `in` features to `out`, that is [in, out].
tensors = [
    tensor("token_embd.weight", [N_EMBD, N_VOCAB]),
    tensor("blk.0.attn_norm.weight", [N_EMBD]),
    tensor("blk.0.attn_q.weight", [N_EMBD, N_EMBD]),
    tensor("blk.0.attn_k.weight", [N_EMBD, N_EMBD]),
    tensor("blk.0.attn_v.weight", [N_EMBD, N_EMBD]),
    tensor("blk.0.attn_output.weight", [N_EMBD, N_EMBD]),
    tensor("blk.0.ffn_norm.weight", [N_EMBD]),
    tensor("blk.0.ffn_gate.weight", [N_EMBD, N_FF]),
    tensor("blk.0.ffn_up.weight", [N_EMBD, N_FF]),
    tensor("blk.0.ffn_down.weight", [N_FF, N_EMBD]),
    tensor("output_norm.weight", [N_EMBD]),
    tensor("output.weight", [N_EMBD, N_VOCAB]),
]

metadata = [
    G.string("general.architecture", "llama"),
    G.string("general.name", "ocade-tiny-probe"),
    G.u32("general.file_type", 0),
    G.u32("llama.context_length", N_CTX),
    G.u32("llama.embedding_length", N_EMBD),
    G.u32("llama.block_count", N_LAYER),
    G.u32("llama.feed_forward_length", N_FF),
    G.u32("llama.attention.head_count", N_HEAD),
    G.u32("llama.attention.head_count_kv", N_HEAD),
    G.f32("llama.attention.layer_norm_rms_epsilon", 1e-5),
    G.u32("llama.rope.dimension_count", N_EMBD // N_HEAD),
    G.f32("llama.rope.freq_base", 10000.0),
    G.u32("general.alignment", G.ALIGNMENT),
    *G.tokenizer_metadata(),
]

out = sys.argv[1] if len(sys.argv) > 1 else "tiny-llama.gguf"
size = G.write_gguf(out, metadata, tensors)
print(f"wrote {out}: {size} bytes, {len(tensors)} tensors, vocab {N_VOCAB}")
