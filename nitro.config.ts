import { defineNitroConfig } from "nitro/config";
import { fileURLToPath } from "node:url";

export default defineNitroConfig({
  // WebLLM is a browser-only runtime. The client build keeps its lazy WebGPU
  // chunks, while the Cloudflare server resolves accidental imports to a tiny
  // fail-closed shim. This avoids both a multi-megabyte server copy and an
  // unresolved bare import in the deployed Worker.
  alias: {
    "@mlc-ai/web-llm": fileURLToPath(
      new URL("./src/lib/brain/adapters/webllm.server.ts", import.meta.url),
    ),
  },
});
