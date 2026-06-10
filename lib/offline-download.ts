// Bulk-downloads an entire Bible translation from the API into IndexedDB so
// the reader and search work offline. downloadTranslation fetches every
// chapter (throttled), then hydrateTranslation persists each chapter, builds
// a MiniSearch index, and records version metadata. hydrateTranslation is
// shared so a prebuilt JSON bundle (public/bibles) can skip the network.

import { allBooks, getApiTranslationId, getBookId, BIBLE_API_BASE } from "@/lib/bible-data"
import { getVersionMeta, putCachedChapter, putSearchIndex, setVersionMeta, type ChapterVerse } from "@/lib/bible-cache"
import { buildIndex, serializeIndex, type IndexDoc } from "@/lib/scripture-index"

export const TOTAL_CHAPTERS: number = allBooks.reduce((sum, book) => sum + book.chapters.length, 0)

export type DownloadProgress = { phase: "fetching" | "indexing" | "done"; done: number; total: number }

const CONCURRENCY = 6

// Versions that ship as a prebuilt JSON bundle under public/bibles instead of
// being fetched from the eightlabs API. CEV and TLB are not served by that API,
// so they can only be hydrated from their baked-in bundle.
export const BUNDLED_VERSIONS: Record<string, string> = {
  KJV: "/bibles/kjv.json",
  BSB: "/bibles/bsb.json",
  CEV: "/bibles/cev.json",
  TLB: "/bibles/tlb.json",
}

// Hydrate a version straight from its prebuilt public/bibles bundle, skipping
// the network entirely. Used for translations the API does not serve.
export async function hydrateFromBundle(
  version: string,
  opts?: { onProgress?: (p: DownloadProgress) => void },
): Promise<void> {
  const url = BUNDLED_VERSIONS[version]
  if (!url) throw new Error(`No bundle for ${version}`)
  opts?.onProgress?.({ phase: "fetching", done: 0, total: TOTAL_CHAPTERS })
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load bundle ${url}: ${res.status}`)
  const data = await res.json()
  opts?.onProgress?.({ phase: "fetching", done: TOTAL_CHAPTERS, total: TOTAL_CHAPTERS })
  await hydrateTranslation(version, data.chapters, { onProgress: opts?.onProgress })
}

// Idempotent, deduped hydration of a baked-in bundle. Returns null for versions
// that don't ship a bundle. Shared by the chapter reader (lazy, on a cache miss)
// and the background warm-up so a version is only ever hydrated once per session
// — concurrent callers await the same in-flight promise.
const bundleHydration = new Map<string, Promise<void>>()

export function ensureBundleHydrated(version: string): Promise<void> | null {
  if (!(version in BUNDLED_VERSIONS)) return null
  let pending = bundleHydration.get(version)
  if (!pending) {
    pending = (async () => {
      if (await getVersionMeta(version)) return
      await hydrateFromBundle(version)
    })()
    // Drop a failed hydration so a later read or warm pass can retry.
    pending.catch(() => bundleHydration.delete(version))
    bundleHydration.set(version, pending)
  }
  return pending
}

async function fetchChapter(
  apiId: string,
  bookId: string,
  chapter: number,
  verseCount: number,
  signal?: AbortSignal,
): Promise<ChapterVerse[]> {
  const url = `${BIBLE_API_BASE}/verses/${bookId}.${chapter}.1-${verseCount}?translation=${apiId}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Failed to fetch ${bookId}.${chapter}: ${res.status}`)
  const data = await res.json()
  if (Array.isArray(data.verses)) {
    return data.verses.map((v: { number: number; text: string }) => ({ number: v.number, text: v.text }))
  }
  return [{ number: 1, text: data.text }]
}

export async function downloadTranslation(
  version: string,
  opts?: { onProgress?: (p: DownloadProgress) => void; signal?: AbortSignal },
): Promise<void> {
  const apiId = getApiTranslationId(version)
  const chapters: Record<string, ChapterVerse[]> = {}

  type Job = { book: string; bookId: string; chapter: number; verseCount: number }
  const jobs: Job[] = []
  for (const book of allBooks) {
    const bookId = getBookId(book.name)
    book.chapters.forEach((verseCount, i) => {
      jobs.push({ book: book.name, bookId, chapter: i + 1, verseCount })
    })
  }

  let done = 0
  let next = 0
  async function worker() {
    while (next < jobs.length) {
      if (opts?.signal?.aborted) throw new DOMException("Aborted", "AbortError")
      const job = jobs[next++]
      const verses = await fetchChapter(apiId, job.bookId, job.chapter, job.verseCount, opts?.signal)
      chapters[`${job.book}:${job.chapter}`] = verses
      done++
      opts?.onProgress?.({ phase: "fetching", done, total: TOTAL_CHAPTERS })
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

  await hydrateTranslation(version, chapters, { onProgress: opts?.onProgress })
}

export async function hydrateTranslation(
  version: string,
  chapters: Record<string, ChapterVerse[]>,
  opts?: { onProgress?: (p: DownloadProgress) => void },
): Promise<void> {
  const docs: IndexDoc[] = []
  const entries = Object.entries(chapters)

  for (const [key, verses] of entries) {
    const sep = key.lastIndexOf(":")
    const book = key.slice(0, sep)
    const chapter = Number(key.slice(sep + 1))
    await putCachedChapter(version, book, chapter, verses)
    for (const verse of verses) {
      docs.push({
        id: `${book}.${chapter}.${verse.number}`,
        reference: `${book} ${chapter}:${verse.number}`,
        text: verse.text,
      })
    }
  }

  opts?.onProgress?.({ phase: "indexing", done: TOTAL_CHAPTERS, total: TOTAL_CHAPTERS })

  const index = buildIndex(docs)
  await putSearchIndex(version, serializeIndex(index))

  await setVersionMeta(version, {
    code: version,
    downloadedAt: Date.now(),
    chapterCount: entries.length,
    complete: true,
  })

  opts?.onProgress?.({ phase: "done", done: TOTAL_CHAPTERS, total: TOTAL_CHAPTERS })
}
