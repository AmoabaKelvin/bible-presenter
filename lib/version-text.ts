// Resolve search results to the operator's active translation.
//
// Lexical hits already carry the active version's text, but semantic hits come
// from the bundled BSB. Since results are previewed and *projected to a screen*,
// every result must read in the version the operator selected — never BSB text
// mislabeled as (say) KJV. This rewrites each result's text to the active
// version, pulling chapters from the local cache first and the API only when a
// chapter isn't cached. If a verse truly can't be resolved (offline + never
// cached), the original text is kept as a last resort.

import { BIBLE_API_BASE, getApiTranslationId, getBookId, type BibleBook } from "@/lib/bible-data"
import { getCachedChapter, putCachedChapter, type ChapterVerse } from "@/lib/bible-cache"
import { parseReference, type ScriptureSearchResult } from "@/lib/scripture-search"

// Cache-first chapter fetch in a specific version. Returns null if unavailable.
async function chapterInVersion(
  version: string,
  book: BibleBook,
  chapter: number,
  signal?: AbortSignal,
): Promise<ChapterVerse[] | null> {
  const cached = await getCachedChapter(version, book.name, chapter)
  if (cached) return cached

  const verseCount = book.chapters[chapter - 1]
  if (!verseCount) return null
  try {
    const bookId = getBookId(book.name)
    const translation = getApiTranslationId(version)
    const url =
      verseCount === 1
        ? `${BIBLE_API_BASE}/verses/${bookId}.${chapter}.1?translation=${translation}`
        : `${BIBLE_API_BASE}/verses/${bookId}.${chapter}.1-${verseCount}?translation=${translation}`
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    const data = await res.json()
    const verses: ChapterVerse[] = Array.isArray(data.verses)
      ? data.verses.map((v: { number: number; text: string }) => ({
          number: v.number,
          text: String(v.text).trim(),
        }))
      : data.text
        ? [{ number: 1, text: String(data.text).trim() }]
        : []
    if (verses.length > 0) {
      void putCachedChapter(version, book.name, chapter, verses)
      return verses
    }
    return null
  } catch {
    return null
  }
}

function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function highlight(text: string, query: string): string {
  const terms = query.trim().split(/\s+/).filter((t) => t.length > 2)
  if (terms.length === 0) return text
  const re = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi")
  return text.replace(re, "<em>$1</em>")
}

export async function resolveResultsToVersion(
  results: ScriptureSearchResult[],
  version: string,
  query: string,
  signal?: AbortSignal,
): Promise<ScriptureSearchResult[]> {
  const parsed = results.map((r) => ({ r, p: parseReference(r.reference) }))

  // Fetch each distinct chapter once, in parallel.
  const wanted = new Map<string, { book: BibleBook; chapter: number }>()
  for (const { p } of parsed) {
    if (!p) continue
    const key = `${p.book.name}:${p.chapter}`
    if (!wanted.has(key)) wanted.set(key, { book: p.book, chapter: p.chapter })
  }

  const textByChapter = new Map<string, Map<number, string>>()
  await Promise.all(
    [...wanted].map(async ([key, { book, chapter }]) => {
      const verses = await chapterInVersion(version, book, chapter, signal)
      if (verses) {
        const m = new Map<number, string>()
        for (const v of verses) m.set(v.number, v.text)
        textByChapter.set(key, m)
      }
    }),
  )

  return parsed.map(({ r, p }) => {
    if (!p) return r
    const text = textByChapter.get(`${p.book.name}:${p.chapter}`)?.get(p.verse)
    if (!text) return r // last resort: keep original text
    return { reference: r.reference, text, highlight: highlight(text, query) }
  })
}
