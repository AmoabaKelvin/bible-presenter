import {
  BIBLE_API_BASE,
  getApiTranslationId,
  allBooks,
  type BibleBook,
} from "@/lib/bible-data"
import { getSearchIndex, getVersionMeta } from "@/lib/bible-cache"
import { loadIndex, queryIndex } from "@/lib/scripture-index"
import type MiniSearch from "minisearch"

export interface ScriptureSearchResult {
  reference: string
  text: string
  // Server-provided snippet with matches wrapped in <em>…</em>.
  highlight?: string
}

export interface ScriptureSearchResponse {
  query: string
  total: number
  limit: number
  offset: number
  results: ScriptureSearchResult[]
}

interface SearchOptions {
  translation: string // version code (e.g. "KJV")
  limit?: number
  offset?: number
  signal?: AbortSignal
}

// Cache loaded MiniSearch instances per version so we don't reparse the
// serialized index on every keystroke.
const indexCache = new Map<string, MiniSearch>()

const emptyResponse = (
  query: string,
  limit: number,
  offset: number,
): ScriptureSearchResponse => ({ query, total: 0, limit, offset, results: [] })

// Load (and memoize) the MiniSearch index for a downloaded version, or null if
// none has been persisted.
async function loadVersionIndex(version: string): Promise<MiniSearch | null> {
  const cached = indexCache.get(version)
  if (cached) return cached
  const json = await getSearchIndex(version)
  if (!json) return null
  const mini = loadIndex(json)
  indexCache.set(version, mini)
  return mini
}

export async function searchScripture(
  query: string,
  { translation, limit = 25, offset = 0, signal }: SearchOptions,
): Promise<ScriptureSearchResponse> {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false
  const downloaded = (await getVersionMeta(translation))?.complete === true

  if (offline || downloaded) {
    const mini = await loadVersionIndex(translation)
    if (mini) return queryIndex(mini, query, { limit, offset })
    if (offline) return emptyResponse(query, limit, offset)
    // Downloaded flag set but no index available — fall through to network.
  }

  const url = new URL(`${BIBLE_API_BASE}/search`)
  url.searchParams.set("q", query)
  url.searchParams.set("translation", getApiTranslationId(translation))
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("offset", String(offset))

  try {
    const res = await fetch(url, { signal })
    if (!res.ok) throw new Error(`Search failed (${res.status})`)
    const data = await res.json()
    return {
      query: data.query ?? query,
      total: typeof data.total === "number" ? data.total : 0,
      limit: typeof data.limit === "number" ? data.limit : limit,
      offset: typeof data.offset === "number" ? data.offset : offset,
      results: Array.isArray(data.results) ? data.results : [],
    }
  } catch (err) {
    const mini = await loadVersionIndex(translation)
    if (mini) return queryIndex(mini, query, { limit, offset })
    throw err
  }
}

// Parse a reference string like "Genesis 1:1", "1 John 2:5", or
// "Song of Solomon 2:16" into a known book + chapter + verse. The
// chapter:verse always trails, so we anchor on that and treat the rest
// as the book name.
export function parseReference(
  reference: string,
): { book: BibleBook; chapter: number; verse: number } | null {
  const m = reference.trim().match(/^(.*?)\s+(\d+):(\d+)$/)
  if (!m) return null
  const name = m[1].trim().toLowerCase()
  const book =
    allBooks.find((b) => b.name.toLowerCase() === name) ??
    allBooks.find((b) => b.name.toLowerCase().startsWith(name))
  if (!book) return null
  return { book, chapter: Number(m[2]), verse: Number(m[3]) }
}

// Drop the <em> highlight markup so a result can be rendered as plain
// verse text on the slide.
export function stripEm(html: string): string {
  return html.replace(/<\/?em>/gi, "")
}
