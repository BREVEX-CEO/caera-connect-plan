"""
TRAIN a tiny llama and export it to GGUF, so output CORRECTNESS can be tested.

WHY. make-tiny-gguf.py proves the runtime runs: real load, real graph, real
tokens, real timings. It cannot say a word about whether the output is RIGHT,
because its weights are random. Testing that needs trained weights, and no
weight host is reachable from this sandbox — huggingface.co and
download.pytorch.org both answer 403 through the proxy. PyPI is reachable, so
the weights are TRAINED here instead of downloaded.

WHAT IT LEARNS. Three capital-city facts, deliberately overfit until the model
reproduces them exactly. This is memorisation, not generalisation, and it is
chosen precisely because memorisation gives an assertion with ONE right answer:
prompt "capital of france is " and the only acceptable completion is "paris".
A model that loads, runs and returns anything else has a real bug in it.

WHAT IT STILL DOES NOT SHOW. Nothing about a production model's answer quality.
A 2-layer, 64-wide network that has memorised three lines is not a language
model. What the exported file supports is an END-TO-END CORRECTNESS check:
tokens in, the graph, sampling, tokens out, exact expected bytes.

ARCHITECTURE. Written to match llama.cpp's `llama` arch exactly, because the
weights are read back by llama.cpp and not by this file: RMSNorm, no biases,
SwiGLU feed-forward, and interleaved-pair RoPE (ggml's NORM mode, the default
for this arch — NOT the split-half NEOX variant HF uses).

Run:  python scripts/fixtures/train-tiny-llama.py
Needs torch. The OUTPUT is committed, so nothing that consumes it needs torch.
"""

import sys
from array import array
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gguf_writer as G  # noqa: E402

N_EMBD, N_LAYER, N_HEAD, N_FF, N_CTX = 64, 2, 4, 128, 128
N_VOCAB = 3 + 256
HEAD_DIM = N_EMBD // N_HEAD
ROPE_BASE = 10000.0
EPS = 1e-5

# Byte token b is id 3 + b: the vocabulary is three specials then all 256 bytes.
BYTE_OFFSET = 3

FACTS = [
    "capital of france is paris\n",
    "capital of japan is tokyo\n",
    "capital of egypt is cairo\n",
]


def encode(text: str) -> list[int]:
    return [BYTE_OFFSET + b for b in text.encode("utf-8")]


def rope(x: torch.Tensor) -> torch.Tensor:
    """
    Interleaved-pair rotation, matching ggml's NORM rope mode.

    x is [batch, heads, seq, head_dim]. Pairs are (0,1), (2,3), ... — adjacent
    elements, not the two halves of the vector. Getting this wrong produces a
    model that trains perfectly here and outputs noise under llama.cpp.
    """
    seq, dim = x.shape[-2], x.shape[-1]
    pos = torch.arange(seq, dtype=torch.float32, device=x.device).unsqueeze(1)
    idx = torch.arange(0, dim, 2, dtype=torch.float32, device=x.device)
    freq = pos / (ROPE_BASE ** (idx / dim))
    cos, sin = torch.cos(freq), torch.sin(freq)
    even, odd = x[..., 0::2], x[..., 1::2]
    out = torch.empty_like(x)
    out[..., 0::2] = even * cos - odd * sin
    out[..., 1::2] = even * sin + odd * cos
    return out


class RMSNorm(nn.Module):
    def __init__(self, dim: int) -> None:
        super().__init__()
        self.weight = nn.Parameter(torch.ones(dim))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x * torch.rsqrt(x.pow(2).mean(-1, keepdim=True) + EPS) * self.weight


class Block(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.attn_norm = RMSNorm(N_EMBD)
        self.q = nn.Linear(N_EMBD, N_EMBD, bias=False)
        self.k = nn.Linear(N_EMBD, N_EMBD, bias=False)
        self.v = nn.Linear(N_EMBD, N_EMBD, bias=False)
        self.o = nn.Linear(N_EMBD, N_EMBD, bias=False)
        self.ffn_norm = RMSNorm(N_EMBD)
        self.gate = nn.Linear(N_EMBD, N_FF, bias=False)
        self.up = nn.Linear(N_EMBD, N_FF, bias=False)
        self.down = nn.Linear(N_FF, N_EMBD, bias=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        b, t, _ = x.shape
        h = self.attn_norm(x)
        shape = (b, t, N_HEAD, HEAD_DIM)
        q = rope(self.q(h).view(shape).transpose(1, 2))
        k = rope(self.k(h).view(shape).transpose(1, 2))
        v = self.v(h).view(shape).transpose(1, 2)
        a = F.scaled_dot_product_attention(q, k, v, is_causal=True)
        x = x + self.o(a.transpose(1, 2).reshape(b, t, N_EMBD))
        h = self.ffn_norm(x)
        return x + self.down(F.silu(self.gate(h)) * self.up(h))


class TinyLlama(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.embd = nn.Embedding(N_VOCAB, N_EMBD)
        self.blocks = nn.ModuleList(Block() for _ in range(N_LAYER))
        self.norm = RMSNorm(N_EMBD)
        self.head = nn.Linear(N_EMBD, N_VOCAB, bias=False)

    def forward(self, ids: torch.Tensor) -> torch.Tensor:
        x = self.embd(ids)
        for block in self.blocks:
            x = block(x)
        return self.head(self.norm(x))


def flat(t: torch.Tensor) -> array:
    return array("f", t.detach().to(torch.float32).contiguous().view(-1).tolist())


def main() -> int:
    torch.manual_seed(7)
    model = TinyLlama()

    # One padded batch of the three facts. Padding is masked out of the loss so
    # the model is never trained to predict filler.
    ids = [encode(f) for f in FACTS]
    width = max(len(i) for i in ids)
    batch = torch.zeros(len(ids), width, dtype=torch.long)
    mask = torch.zeros(len(ids), width, dtype=torch.bool)
    for row, seq in enumerate(ids):
        batch[row, : len(seq)] = torch.tensor(seq)
        mask[row, : len(seq)] = True

    inputs, targets, keep = batch[:, :-1], batch[:, 1:], mask[:, 1:]
    opt = torch.optim.AdamW(model.parameters(), lr=3e-3, weight_decay=0.0)

    loss = torch.tensor(float("inf"))
    for step in range(4000):
        logits = model(inputs)
        loss = F.cross_entropy(
            logits.reshape(-1, N_VOCAB)[keep.reshape(-1)],
            targets.reshape(-1)[keep.reshape(-1)],
        )
        opt.zero_grad()
        loss.backward()
        opt.step()
        if loss.item() < 1e-4:
            print(f"converged at step {step}, loss {loss.item():.2e}")
            break
        if step % 500 == 0:
            print(f"step {step:5d}  loss {loss.item():.4f}")

    # Check it here before exporting: a file that fails under llama.cpp should
    # fail because of the EXPORT, and ruling the training out first is what
    # makes that distinction possible.
    model.eval()
    with torch.no_grad():
        for fact in FACTS:
            prompt, expected = fact.split(" is ")[0] + " is ", fact.split(" is ")[1]
            cur = encode(prompt)
            for _ in range(len(expected)):
                cur.append(int(model(torch.tensor([cur]))[0, -1].argmax()))
            got = bytes(t - BYTE_OFFSET for t in cur[len(encode(prompt)) :]).decode(
                "utf-8", "replace"
            )
            status = "OK " if got == expected else "BAD"
            print(f"  {status} {prompt!r} -> {got!r}")
            if got != expected:
                print("training did not converge; not exporting.", file=sys.stderr)
                return 1

    metadata = [
        G.string("general.architecture", "llama"),
        G.string("general.name", "ocade-tiny-trained"),
        G.u32("general.file_type", 0),
        G.u32("llama.context_length", N_CTX),
        G.u32("llama.embedding_length", N_EMBD),
        G.u32("llama.block_count", N_LAYER),
        G.u32("llama.feed_forward_length", N_FF),
        G.u32("llama.attention.head_count", N_HEAD),
        G.u32("llama.attention.head_count_kv", N_HEAD),
        G.f32("llama.attention.layer_norm_rms_epsilon", EPS),
        G.u32("llama.rope.dimension_count", HEAD_DIM),
        G.f32("llama.rope.freq_base", ROPE_BASE),
        G.u32("general.alignment", G.ALIGNMENT),
        *G.tokenizer_metadata(),
    ]

    tensors: list[tuple[str, list[int], array]] = [
        ("token_embd.weight", [N_EMBD, N_VOCAB], flat(model.embd.weight)),
    ]
    for i, block in enumerate(model.blocks):
        tensors += [
            (f"blk.{i}.attn_norm.weight", [N_EMBD], flat(block.attn_norm.weight)),
            (f"blk.{i}.attn_q.weight", [N_EMBD, N_EMBD], flat(block.q.weight)),
            (f"blk.{i}.attn_k.weight", [N_EMBD, N_EMBD], flat(block.k.weight)),
            (f"blk.{i}.attn_v.weight", [N_EMBD, N_EMBD], flat(block.v.weight)),
            (f"blk.{i}.attn_output.weight", [N_EMBD, N_EMBD], flat(block.o.weight)),
            (f"blk.{i}.ffn_norm.weight", [N_EMBD], flat(block.ffn_norm.weight)),
            (f"blk.{i}.ffn_gate.weight", [N_EMBD, N_FF], flat(block.gate.weight)),
            (f"blk.{i}.ffn_up.weight", [N_EMBD, N_FF], flat(block.up.weight)),
            (f"blk.{i}.ffn_down.weight", [N_FF, N_EMBD], flat(block.down.weight)),
        ]
    tensors += [
        ("output_norm.weight", [N_EMBD], flat(model.norm.weight)),
        ("output.weight", [N_EMBD, N_VOCAB], flat(model.head.weight)),
    ]

    out = sys.argv[1] if len(sys.argv) > 1 else "scripts/fixtures/tiny-llama-trained.gguf"
    size = G.write_gguf(out, metadata, tensors)
    print(f"wrote {out}: {size} bytes, {len(tensors)} tensors, vocab {N_VOCAB}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
