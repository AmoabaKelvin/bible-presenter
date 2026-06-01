import type { SelectedVerse } from "@/components/slide-stage"
import type { ChapterVerse } from "@/components/operator/chapter-reader"
import type { BibleBook } from "@/lib/bible-data"
import {
  parseReference,
  stripEm,
  type ScriptureSearchResult,
} from "@/lib/scripture-search"

type BuildScriptureSlidesOptions = {
  book: BibleBook | null
  chapter: number | null
  verses: ChapterVerse[]
  version: string
  start: number
  end: number
}

export function buildScriptureSlides({
  book,
  chapter,
  verses,
  version,
  start,
  end,
}: BuildScriptureSlidesOptions): SelectedVerse[] {
  if (!book || !chapter || verses.length === 0) return []
  const items = verses.filter((v) => v.number >= start && v.number <= end)
  if (items.length === 0) return []
  if (start === end) {
    const verse = items[0]
    return [
      {
        kind: "scripture",
        id: `${book.name}-${chapter}-${verse.number}`,
        book: book.name,
        chapter,
        verse: verse.number,
        text: verse.text,
        reference: `${book.name} ${chapter}:${verse.number}`,
        version,
      },
    ]
  }
  const text = items
    .map((v) => `<sup class="text-blue-500 font-semibold mr-1">${v.number}</sup>${v.text}`)
    .join(" ")
  return [
    {
      kind: "scripture",
      id: `${book.name}-${chapter}-${start}-${end}`,
      book: book.name,
      chapter,
      verse: start,
      text,
      reference: `${book.name} ${chapter}:${start}-${end}`,
      version,
    },
  ]
}

export function scriptureSlideFromSearchResult(
  result: ScriptureSearchResult,
  version: string,
): SelectedVerse {
  const parsed = parseReference(result.reference)
  return {
    kind: "scripture",
    id: `search-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    book: parsed?.book.name ?? "",
    chapter: parsed?.chapter ?? 0,
    verse: parsed?.verse ?? 0,
    text: stripEm(result.text),
    reference: result.reference,
    version,
  }
}
