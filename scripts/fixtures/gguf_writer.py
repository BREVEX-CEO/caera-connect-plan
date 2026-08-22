"""
A minimal GGUF v3 writer, shared by the fixture generators.

Extracted from make-tiny-gguf.py when a second generator needed it. Stdlib
only, on purpose: these run on a bare CI python with no `pip install` in front
of them.

Format: GGUF v3 — https://github.com/ggml-org/ggml/blob/master/docs/gguf.md
"""

import struct
from array import array

# GGUF metadata value types.
U32, I32, F32_T, STR, ARR, U64 = 4, 5, 6, 8, 9, 10
GGML_F32 = 0
ALIGNMENT = 32


def s(text: str) -> bytes:
    raw = text.encode("utf-8")
    return struct.pack("<Q", len(raw)) + raw


def kv(key: str, vtype: int, payload: bytes) -> bytes:
    return s(key) + struct.pack("<I", vtype) + payload


def arr(elem_type: int, items: list[bytes]) -> bytes:
    return struct.pack("<IQ", elem_type, len(items)) + b"".join(items)


def u32(key: str, value: int) -> bytes:
    return kv(key, U32, struct.pack("<I", value))


def f32(key: str, value: float) -> bytes:
    return kv(key, F32_T, struct.pack("<f", value))


def string(key: str, value: str) -> bytes:
    return kv(key, STR, s(value))


def byte_fallback_vocabulary() -> tuple[list[str], list[float], list[int]]:
    """
    SentencePiece-shaped: three specials, then every byte as a fallback piece.

    The bytes are not optional decoration. llama.cpp resolves the newline
    through `byte_to_token('\\n')` while building an SPM vocabulary, and a
    vocabulary without <0x0A> aborts the load with `_Map_base::at`.

    token_type: 2 = UNKNOWN, 3 = CONTROL, 6 = BYTE.
    """
    tokens = ["<unk>", "<s>", "</s>"] + [f"<0x{b:02X}>" for b in range(256)]
    scores = [0.0] * len(tokens)
    types = [2, 3, 3] + [6] * 256
    return tokens, scores, types


def tokenizer_metadata() -> list[bytes]:
    tokens, scores, types = byte_fallback_vocabulary()
    return [
        string("tokenizer.ggml.model", "llama"),
        kv("tokenizer.ggml.tokens", ARR, arr(STR, [s(t) for t in tokens])),
        kv("tokenizer.ggml.scores", ARR, arr(F32_T, [struct.pack("<f", x) for x in scores])),
        kv("tokenizer.ggml.token_type", ARR, arr(I32, [struct.pack("<i", x) for x in types])),
        u32("tokenizer.ggml.bos_token_id", 1),
        u32("tokenizer.ggml.eos_token_id", 2),
        u32("tokenizer.ggml.unknown_token_id", 0),
    ]


def write_gguf(path: str, metadata: list[bytes], tensors: list[tuple[str, list[int], array]]) -> int:
    """
    `tensors` is (name, ne, data). `ne` is in ggml order: ne[0] is the
    fastest-moving axis, so a weight mapping `in` features to `out` is
    [in, out] — which is exactly the memory order of a torch Linear's
    [out, in] weight, no transpose needed.
    """
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
    body += b"\x00" * (-len(body) % ALIGNMENT)

    for _name, _ne, data in tensors:
        raw = data.tobytes()
        body += raw + b"\x00" * (-len(raw) % ALIGNMENT)

    with open(path, "wb") as handle:
        handle.write(body)
    return len(body)
