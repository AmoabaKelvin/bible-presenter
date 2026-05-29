// A MiniSearch wrapper for full-text scripture search over a downloaded
// translation. Indexes verse text, persists as JSON, and reloads to answer
// queries in the same { reference, text, highlight } shape the live API uses.

import MiniSearch from "minisearch"
import type { ScriptureSearchResponse } from "@/lib/scripture-search"

export type IndexDoc = { id: string; reference: string; text: string }

const FIELDS = ["text"]
const STORE_FIELDS = ["reference", "text"]

export function buildIndex(docs: IndexDoc[]): MiniSearch {
  const mini = new MiniSearch({ fields: FIELDS, storeFields: STORE_FIELDS })
  mini.addAll(docs)
  return mini
}

export function serializeIndex(mini: MiniSearch): string {
  return JSON.stringify(mini)
}

export function loadIndex(json: string): MiniSearch {
  return MiniSearch.loadJSON(json, {
    fields: FIELDS,
    storeFields: STORE_FIELDS,
  })
}

// Escape a term so it can be safely embedded in a RegExp.
function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// Wrap each matched query term in <em>…</em>, mirroring the server snippet.
function highlightText(text: string, query: string): string {
  const terms = query.trim().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return text
  const pattern = terms.map(escapeRegExp).join("|")
  const re = new RegExp(`(${pattern})`, "gi")
  return text.replace(re, "<em>$1</em>")
}

export function queryIndex(
  mini: MiniSearch,
  query: string,
  opts: { limit: number; offset: number },
): ScriptureSearchResponse {
  const all = mini.search(query, { prefix: true, fuzzy: 0.1 })
  const page = all.slice(opts.offset, opts.offset + opts.limit)
  return {
    query,
    total: all.length,
    limit: opts.limit,
    offset: opts.offset,
    results: page.map((r) => ({
      reference: r.reference as string,
      text: r.text as string,
      highlight: highlightText(r.text as string, query),
    })),
  }
}
