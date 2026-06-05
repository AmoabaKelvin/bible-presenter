// Self-host the embedding model + ONNX-runtime WASM so the Bible "find by
// meaning" search works fully offline (no HuggingFace / CDN at runtime).
//
// Downloads the quantized (q8) bge-small model + tokenizer/config into
// public/models/, and copies the ONNX-runtime WASM (the default jsep build
// transformers.js uses) into public/ort/. The runtime (lib/semantic-search.ts)
// points transformers.js at these local paths.
//
// Usage: node scripts/fetch-model.mjs   (~60 MB of downloads, run once)

import { writeFile, mkdir, copyFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const MODEL = "Xenova/bge-small-en-v1.5"
const HF = `https://huggingface.co/${MODEL}/resolve/main`
const modelDir = join(root, "public", "models", MODEL)
const ortDir = join(root, "public", "ort")

// Only the q8 model is shipped (the browser uses quantized; the fp32 model is
// 127 MB and unnecessary).
const MODEL_FILES = [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "onnx/model_quantized.onnx",
]
// The app isn't cross-origin isolated (no SharedArrayBuffer), so ONNX-runtime
// uses the single-threaded "asyncify" build — verified as the variant the
// browser requests. (The threaded "jsep" build would only be used under
// cross-origin isolation; add it here if that ever changes.)
const ORT_FILES = [
  "ort-wasm-simd-threaded.asyncify.wasm",
  "ort-wasm-simd-threaded.asyncify.mjs",
]

async function download(rel) {
  const res = await fetch(`${HF}/${rel}`)
  if (!res.ok) throw new Error(`${res.status} fetching ${rel}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const out = join(modelDir, rel)
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, buf)
  console.log(`  model: ${rel} (${(buf.length / 1e6).toFixed(1)} MB)`)
}

async function run() {
  await mkdir(modelDir, { recursive: true })
  console.log(`downloading ${MODEL}…`)
  for (const f of MODEL_FILES) await download(f)

  await mkdir(ortDir, { recursive: true })
  const ortSrc = join(root, "node_modules", "onnxruntime-web", "dist")
  for (const f of ORT_FILES) {
    await copyFile(join(ortSrc, f), join(ortDir, f))
    console.log(`  ort: ${f}`)
  }
  console.log("done — model + wasm are in public/")
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
