import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.FLOWCAST_DESKTOP_BUILD === "1" ? {
    output: "standalone" as const,
    experimental: { isrFlushToDisk: false },
  } : {}),
  // transformers.js is browser-only here (lazy-loaded in lib/semantic-search.ts);
  // keep its native onnxruntime binding out of the server bundle for Workers.
  // "#transformers" resolves to the real package in the browser and to the
  // server stub (package.json "imports") everywhere else.
  turbopack: {
    resolveAlias: {
      "#transformers": { browser: "@huggingface/transformers" },
    },
  },
  outputFileTracingExcludes: {
    "*": [
      "node_modules/@huggingface/transformers/**",
      "node_modules/onnxruntime-node/**",
      "node_modules/onnxruntime-web/**",
    ],
  },
};

export default async function config() {
  if (process.env.FLOWCAST_DESKTOP_BUILD !== "1") {
    const { initOpenNextCloudflareForDev } = await import("@opennextjs/cloudflare");
    initOpenNextCloudflareForDev();
  }
  return nextConfig;
}
