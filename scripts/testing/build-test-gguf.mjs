/**
 * Build a REAL, loadable GGUF model file.
 *
 * WHY THIS EXISTS. Proving that OCADE's browser engine actually generates
 * needs a model the real runtime can really load. The production weights live
 * on huggingface.co, which this environment's network policy refuses (curl
 * returns 000; the agent proxy logs CONNECT denials), and no npm package
 * bundles a real GGUF — the two that looked promising unpack to 37 KB and
 * 551 KB.
 *
 * So the file is built here instead. It is not a mock and not a fixture stub:
 * it is a structurally valid llama-architecture GGUF with a working
 * SentencePiece vocabulary and byte fallback, which llama.cpp — and therefore
 * wllama in the browser — parses, loads and runs a real generation loop over.
 *
 * WHAT IT PROVES AND WHAT IT DOES NOT. Every mechanism is real: the download,
 * the resume, the checksum, the OPFS write, the GGUF parse, the tokenizer, the
 * KV cache, the sampling loop, token streaming and cancellation. The WEIGHTS
 * are random, so the text that comes out is meaningless. Answer quality is the
 * one property this cannot show, and it is exactly the property that depends
 * on the weights this environment cannot reach.
 *
 * Usage: node scripts/testing/build-test-gguf.mjs <out.gguf>
 */
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

/* ---- GGUF value types ---- */
const T = {
  UINT32: 4,
  INT32: 5,
  FLOAT32: 6,
  STRING: 8,
  ARRAY: 9,
  UINT64: 10,
};

/** SentencePiece token types, as llama.cpp reads them. */
const TOKEN_TYPE = { NORMAL: 1, UNKNOWN: 2, CONTROL: 3, BYTE: 6 };

/* ---- Model shape. Tiny on purpose; the architecture is what matters. ---- */
const N_EMBD = 64;
const N_LAYER = 2;
const N_HEAD = 4;
const N_HEAD_KV = 4;
const N_FF = 128;
const N_CTX = 512;

/**
 * A minimal SentencePiece vocabulary with byte fallback.
 *
 * Byte fallback is what makes this able to encode ANY input: a piece the
 * vocabulary does not contain is decomposed into `<0xNN>` tokens, so the
 * tokenizer never fails on unexpected text. Without it a prompt containing a
 * character outside the vocabulary would abort the load-and-run.
 */
function buildVocab() {
  const tokens = ["<unk>", "<s>", "</s>"];
  const types = [TOKEN_TYPE.UNKNOWN, TOKEN_TYPE.CONTROL, TOKEN_TYPE.CONTROL];

  /*
   * BYTE FALLBACK IS REQUIRED, AND IT IS ALSO THE THING THAT BREAKS OUTPUT.
   *
   * llama.cpp's SentencePiece tokenizer looks byte tokens up by name when a
   * piece is not in the vocabulary. Removing them to keep generated text valid
   * produced "Failed to format input: unordered_map::at: key not found" — the
   * tokenizer asking for `<0xNN>` and not finding it. They have to be here.
   *
   * With random weights the sampler then picks them uniformly, emitting
   * arbitrary bytes that form invalid UTF-8, which cannot cross the worker
   * boundary. That is solved on the SAMPLING side instead: the harness passes
   * `logit_bias` banning this range, which is a runtime concern rather than a
   * file-format one. `BYTE_TOKEN_RANGE` below is exported in the manifest so
   * the harness does not have to hardcode the offsets.
   */
  const byteStart = tokens.length;
  for (let b = 0; b < 256; b += 1) {
    tokens.push(`<0x${b.toString(16).toUpperCase().padStart(2, "0")}>`);
    /*
     * Present by NAME so the tokenizer's lookup succeeds, but typed NORMAL
     * rather than BYTE so the detokenizer emits the literal text "<0x41>"
     * instead of raw byte 0x41.
     *
     * This is the fix that made the run complete. Typed BYTE, a random-weight
     * sampler emits arbitrary bytes; those form invalid UTF-8; the generated
     * string then cannot be JSON-encoded across the worker boundary, and
     * wllama's transport desynchronised — surfacing as "Invalid typed array
     * length: 1163217991", which is 0x45554c47, wllama's own "GLUE" magic
     * being read as a length. Generation had already succeeded by then; only
     * returning the text failed.
     *
     * A real model does not need this because its weights make byte tokens
     * rare and well-formed. Nothing about the load, tokenise, forward-pass or
     * sampling path changes.
     */
    types.push(TOKEN_TYPE.NORMAL);
  }
  const byteEnd = tokens.length - 1;

  for (let c = 32; c < 127; c += 1) {
    tokens.push(String.fromCharCode(c));
    types.push(TOKEN_TYPE.NORMAL);
  }
  // U+2581 is SentencePiece's space marker; whole words exercise the
  // longest-match path rather than character-by-character tokenisation.
  for (const piece of [
    "\u2581the",
    "\u2581a",
    "\u2581is",
    "\u2581OCADE",
    "\u2581hello",
    "\u2581world",
    "\u2581this",
    "\u2581device",
    "\u2581local",
    "\u2581answer",
  ]) {
    tokens.push(piece);
    types.push(TOKEN_TYPE.NORMAL);
  }
  const scores = tokens.map((_, i) => -Number(i));
  return { tokens, types, scores, byteStart, byteEnd };
}

/* ---- Writer ---- */
const chunks = [];
const push = (b) => chunks.push(b);
const u32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
};
const i32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeInt32LE(n);
  return b;
};
const u64 = (n) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b;
};
const f32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeFloatLE(n);
  return b;
};
const str = (s) => {
  const t = Buffer.from(s, "utf8");
  return Buffer.concat([u64(t.length), t]);
};

function kvString(key, value) {
  push(str(key));
  push(u32(T.STRING));
  push(str(value));
}
function kvU32(key, value) {
  push(str(key));
  push(u32(T.UINT32));
  push(u32(value));
}
function kvF32(key, value) {
  push(str(key));
  push(u32(T.FLOAT32));
  push(f32(value));
}
function kvArrayStr(key, values) {
  push(str(key));
  push(u32(T.ARRAY));
  push(u32(T.STRING));
  push(u64(values.length));
  for (const v of values) push(str(v));
}
function kvArrayI32(key, values) {
  push(str(key));
  push(u32(T.ARRAY));
  push(u32(T.INT32));
  push(u64(values.length));
  for (const v of values) push(i32(v));
}
function kvArrayF32(key, values) {
  push(str(key));
  push(u32(T.ARRAY));
  push(u32(T.FLOAT32));
  push(u64(values.length));
  for (const v of values) push(f32(v));
}

const vocab = buildVocab();
const N_VOCAB = vocab.tokens.length;

/**
 * Tensor list. `dims` follow GGUF order: fastest-varying dimension first,
 * which for a weight matrix means [in_features, out_features].
 */
const tensors = [["token_embd.weight", [N_EMBD, N_VOCAB]]];
for (let l = 0; l < N_LAYER; l += 1) {
  tensors.push(
    [`blk.${l}.attn_norm.weight`, [N_EMBD]],
    [`blk.${l}.attn_q.weight`, [N_EMBD, N_EMBD]],
    [`blk.${l}.attn_k.weight`, [N_EMBD, (N_EMBD / N_HEAD) * N_HEAD_KV]],
    [`blk.${l}.attn_v.weight`, [N_EMBD, (N_EMBD / N_HEAD) * N_HEAD_KV]],
    [`blk.${l}.attn_output.weight`, [N_EMBD, N_EMBD]],
    [`blk.${l}.ffn_norm.weight`, [N_EMBD]],
    [`blk.${l}.ffn_gate.weight`, [N_EMBD, N_FF]],
    [`blk.${l}.ffn_up.weight`, [N_EMBD, N_FF]],
    [`blk.${l}.ffn_down.weight`, [N_FF, N_EMBD]],
  );
}
tensors.push(["output_norm.weight", [N_EMBD]], ["output.weight", [N_EMBD, N_VOCAB]]);

/* ---- Header ---- */
push(Buffer.from("GGUF", "ascii"));
push(u32(3));
push(u64(tensors.length));

const metaChunks = [];
{
  const outer = chunks.length;
  kvString("general.architecture", "llama");
  kvString("general.name", "ocade-inference-proof");
  kvU32("llama.block_count", N_LAYER);
  kvU32("llama.context_length", N_CTX);
  kvU32("llama.embedding_length", N_EMBD);
  kvU32("llama.feed_forward_length", N_FF);
  kvU32("llama.attention.head_count", N_HEAD);
  kvU32("llama.attention.head_count_kv", N_HEAD_KV);
  kvF32("llama.attention.layer_norm_rms_epsilon", 1e-5);
  kvU32("llama.rope.dimension_count", N_EMBD / N_HEAD);
  kvString("tokenizer.ggml.model", "llama");
  /*
   * A chat template, because the runtime looks for one.
   *
   * Without it wllama fell back to parsing the raw generated text as a chat
   * response, and with random weights that text is arbitrary bytes — which
   * produced "Failed to parse input at pos 22" and then killed the worker.
   * Real instruction-tuned models all carry a template; omitting it was the
   * harness being unrealistic, not the runtime being fragile.
   */
  kvString(
    "tokenizer.chat_template",
    "{% for m in messages %}{{ m['role'] }}: {{ m['content'] }}\n{% endfor %}assistant: ",
  );
  kvArrayStr("tokenizer.ggml.tokens", vocab.tokens);
  kvArrayF32("tokenizer.ggml.scores", vocab.scores);
  kvArrayI32("tokenizer.ggml.token_type", vocab.types);
  kvU32("tokenizer.ggml.bos_token_id", 1);
  kvU32("tokenizer.ggml.eos_token_id", 2);
  kvU32("tokenizer.ggml.unknown_token_id", 0);
  metaChunks.push(chunks.length - outer);
}
// The KV count has to precede the pairs, so it is spliced in after counting.
const KV_COUNT = 18;
chunks.splice(3, 0, u64(KV_COUNT));

/* ---- Tensor info ---- */
const ALIGN = 32;
let offset = 0;
const infos = [];
for (const [name, dims] of tensors) {
  infos.push({ name, dims, offset });
  const elements = dims.reduce((a, b) => a * b, 1);
  const bytes = elements * 4; // F32
  offset += Math.ceil(bytes / ALIGN) * ALIGN;
}
for (const info of infos) {
  push(str(info.name));
  push(u32(info.dims.length));
  for (const d of info.dims) push(u64(d));
  push(u32(0)); // GGML_TYPE_F32
  push(u64(info.offset));
}

const header = Buffer.concat(chunks);
const pad = Math.ceil(header.length / ALIGN) * ALIGN - header.length;

/* ---- Tensor data ---- */
/*
 * Deterministic pseudo-random weights from a fixed seed, so the same file is
 * produced on every run and its digest can be pinned. Values are small: a
 * random network with large weights produces NaNs on the first forward pass,
 * which llama.cpp reports as a load failure rather than as gibberish.
 */
let seed = 0x2026_08_23 >>> 0;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 0xffffffff) * 0.04 - 0.02;
};
const data = Buffer.alloc(offset);
for (const info of infos) {
  const elements = info.dims.reduce((a, b) => a * b, 1);
  const isNorm = /norm\.weight$/.test(info.name);
  for (let i = 0; i < elements; i += 1) {
    // RMS-norm weights sit around 1.0; everything else is small and centred.
    data.writeFloatLE(isNorm ? 1 + rand() : rand(), info.offset + i * 4);
  }
}

const file = Buffer.concat([header, Buffer.alloc(pad), data]);
const out = process.argv[2] ?? "ocade-proof.gguf";
writeFileSync(out, file);
const digest = createHash("sha256").update(file).digest("hex");
console.log(
  JSON.stringify(
    {
      path: out,
      bytes: file.length,
      sha256: digest,
      tensors: tensors.length,
      vocab: N_VOCAB,
      arch: "llama",
      byteTokenRange: [vocab.byteStart, vocab.byteEnd],
      layers: N_LAYER,
      embedding: N_EMBD,
      context: N_CTX,
    },
    null,
    2,
  ),
);
