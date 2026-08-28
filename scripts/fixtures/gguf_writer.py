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
U32, I32, F32_T, BOOL, STR, ARR, U64 = 4, 5, 6, 7, 8, 9, 10
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


def bool_kv(key: str, value: bool) -> bytes:
    return kv(key, BOOL, struct.pack("<?", value))


def byte_level_vocabulary() -> tuple[list[str], list[int]]:
    """
    Three specials, then every byte, in GPT-2's byte-to-unicode encoding.

    WHY BYTE-LEVEL AND NOT SENTENCEPIECE, WHICH THIS USED TO BE. The fixtures
    exist so a runtime's OUTPUT can be checked, and that only works if the
    prompt a test writes is the token sequence the model was trained on. A
    SentencePiece vocabulary breaks that: llama.cpp escapes every space to
    U+2581 and prepends one more before tokenising, so "capital of france is "
    arrived as three byte tokens per space and the trained model was being
    asked a question it had never seen. Feeding hand-built ids around the
    tokenizer hid the problem in one harness and was impossible in another —
    wllama's completion API takes text and nothing else.

    Byte-level BPE has no such rewriting. Every byte is its own piece, so
    token id 3 + b is byte b for every b, and text tokenises to exactly its
    bytes with no merges to apply. It is also the family the production model
    uses, so the fixtures exercise the same tokenizer shape the product does.

    The mapping is GPT-2's: printable ASCII and two Latin-1 runs keep their
    own code points, and the remaining 68 bytes are lifted into U+0100 and
    upwards so that no piece is whitespace or a control character.
    """
    printable = list(range(0x21, 0x7F)) + list(range(0xA1, 0xAD)) + list(range(0xAE, 0x100))
    codes = printable[:]
    spare = 0
    for byte in range(256):
        if byte not in printable:
            printable.append(byte)
            codes.append(0x100 + spare)
            spare += 1
    encoding = {byte: chr(code) for byte, code in zip(printable, codes)}

    tokens = ["<unk>", "<s>", "</s>"] + [encoding[b] for b in range(256)]
    # token_type: 2 = UNKNOWN, 3 = CONTROL, 1 = NORMAL.
    types = [2, 3, 3] + [1] * 256
    return tokens, types


def tokenizer_metadata() -> list[bytes]:
    tokens, types = byte_level_vocabulary()
    return [
        string("tokenizer.ggml.model", "gpt2"),
        string("tokenizer.ggml.pre", "default"),
        kv("tokenizer.ggml.tokens", ARR, arr(STR, [s(t) for t in tokens])),
        kv("tokenizer.ggml.token_type", ARR, arr(I32, [struct.pack("<i", x) for x in types])),
        # Deliberately empty. Merges are what turn byte pieces into longer
        # ones; with none, every piece stays a single byte, which is the
        # property the fixtures rely on.
        kv("tokenizer.ggml.merges", ARR, arr(STR, [])),
        u32("tokenizer.ggml.bos_token_id", 1),
        u32("tokenizer.ggml.eos_token_id", 2),
        u32("tokenizer.ggml.unknown_token_id", 0),
        # No sentinel is prepended: the fixtures were trained on bare bytes,
        # and a BOS the training never saw would change the first prediction.
        bool_kv("tokenizer.ggml.add_bos_token", False),
        bool_kv("tokenizer.ggml.add_eos_token", False),
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
