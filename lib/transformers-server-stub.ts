// Server-side stand-in for "@huggingface/transformers", wired up via the
// "#transformers" subpath import in package.json. The real module is
// browser-only here (semantic search runs client-side); bundling it for the
// server drags in the onnxruntime-node native binary, which Cloudflare
// Workers cannot load. This path never executes at runtime.
type Transformers = typeof import("@huggingface/transformers")

export const pipeline = (() => {
  throw new Error("@huggingface/transformers is browser-only")
}) as unknown as Transformers["pipeline"]

export const env = {} as Transformers["env"]
