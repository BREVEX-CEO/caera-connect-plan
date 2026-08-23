"""
Build a VALID, TINY GGUF so real inference can be executed without a download.

WHY THIS EXISTS. Proving the on-device engine needs weights, and no weight host
is reachable from this sandbox — huggingface.co and ollama.com both answer 403
through the proxy. A stub HTTP engine proves the pipeline around the model; it
proves nothing about the model runtime itself. So the weights are constructed
here instead: a real GGUF, correct in every field llama.cpp reads, holding a
one-layer llama with a 32-token vocabulary.

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
import struct
import sys
from array import array

# GGUF metadata value types
U32, F32_T, STR, ARR, U64 = 4, 6, 8, 9, 10
I32 = 5
GGML_F32 = 0
ALIGNMENT = 32

# A deliberately tiny llama. Big enough to be a real graph, small enough that
# the file is a few hundred kilobytes and the test runs in seconds.
# The vocabulary is 3 specials plus all 256 byte-fallback tokens. The bytes are
# not optional decoration: llama.cpp resolves the newline through
# `byte_to_token('\n')` while building an SPM vocabulary, and a vocabulary
# without <0x0A> aborts the load with `_Map_base::at`.
N_EMBD, N_LAYER, N_HEAD, N_FF, N_CTX = 32, 1, 2, 64, 64
N_VOCAB = 3 + 256


def s(text: str) -> bytes:
    raw = text.encode("utf-8")
    return struct.pack("<Q", len(raw)) + raw


def kv(key: str, vtype: int, payload: bytes) -> bytes:
    return s(key) + struct.pack("<I", vtype) + payload


def arr(elem_type: int, items: list[bytes]) -> bytes:
    return struct.pack("<IQ", elem_type, len(items)) + b"".join(items)


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

# SentencePiece-shaped: the three specials, then every byte as a fallback piece.
# token_type: 2 = UNKNOWN, 3 = CONTROL, 6 = BYTE.
tokens = ["<unk>", "<s>", "</s>"] + [f"<0x{b:02X}>" for b in range(256)]
scores = [0.0] * N_VOCAB
token_types = [2, 3, 3] + [6] * 256

metadata = [
    kv("general.architecture", STR, s("llama")),
    kv("general.name", STR, s("ocade-tiny-probe")),
    kv("general.file_type", U32, struct.pack("<I", 0)),
    kv("llama.context_length", U32, struct.pack("<I", N_CTX)),
    kv("llama.embedding_length", U32, struct.pack("<I", N_EMBD)),
    kv("llama.block_count", U32, struct.pack("<I", N_LAYER)),
    kv("llama.feed_forward_length", U32, struct.pack("<I", N_FF)),
    kv("llama.attention.head_count", U32, struct.pack("<I", N_HEAD)),
    kv("llama.attention.head_count_kv", U32, struct.pack("<I", N_HEAD)),
    kv("llama.attention.layer_norm_rms_epsilon", F32_T, struct.pack("<f", 1e-5)),
    kv("llama.rope.dimension_count", U32, struct.pack("<I", N_EMBD // N_HEAD)),
    kv("llama.rope.freq_base", F32_T, struct.pack("<f", 10000.0)),
    kv("general.alignment", U32, struct.pack("<I", ALIGNMENT)),
    kv("tokenizer.ggml.model", STR, s("llama")),
    kv("tokenizer.ggml.tokens", ARR, arr(STR, [s(t) for t in tokens])),
    kv("tokenizer.ggml.scores", ARR, arr(F32_T, [struct.pack("<f", x) for x in scores])),
    kv("tokenizer.ggml.token_type", ARR, arr(I32, [struct.pack("<i", x) for x in token_types])),
    kv("tokenizer.ggml.bos_token_id", U32, struct.pack("<I", 1)),
    kv("tokenizer.ggml.eos_token_id", U32, struct.pack("<I", 2)),
    kv("tokenizer.ggml.unknown_token_id", U32, struct.pack("<I", 0)),
]

header = b"GGUF" + struct.pack("<IQQ", 3, len(tensors), len(metadata))
header += b"".join(metadata)

# Tensor info block, with offsets relative to the start of the data section.
infos = b""
offset = 0
for name, ne, data in tensors:
    infos += s(name) + struct.pack("<I", len(ne))
    for d in ne:
        infos += struct.pack("<Q", d)
    infos += struct.pack("<IQ", GGML_F32, offset)
    size = data.itemsize * len(data)
    offset += size + (-size % ALIGNMENT)

body = header + infos
pad = -len(body) % ALIGNMENT
body += b"\x00" * pad

for _name, _ne, data in tensors:
    raw = data.tobytes()
    body += raw + b"\x00" * (-len(raw) % ALIGNMENT)

out = sys.argv[1] if len(sys.argv) > 1 else "tiny-llama.gguf"
with open(out, "wb") as handle:
    handle.write(body)
print(f"wrote {out}: {len(body)} bytes, {len(tensors)} tensors, vocab {N_VOCAB}")
