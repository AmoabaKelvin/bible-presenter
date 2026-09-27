import { allBooks, type BibleBook } from "@/lib/bible-data"

export type ParsedScriptureReference = {
  book: BibleBook
  chapter: number
  verse?: number
}

export function matchScriptureBooks(query: string): BibleBook[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const starts: BibleBook[] = []
  const contains: BibleBook[] = []
  for (const book of allBooks) {
    const name = book.name.toLowerCase()
    if (name.startsWith(q)) starts.push(book)
    else if (name.includes(q)) contains.push(book)
  }
  const byName = (a: BibleBook, b: BibleBook) => a.name.localeCompare(b.name)
  starts.sort(byName)
  contains.sort(byName)
  return [...starts, ...contains]
}

export function allowsScriptureBookSpace(query: string) {
  const withSpace = `${query} `
  return allBooks.some((book) =>
    book.name.toLowerCase().startsWith(withSpace.toLowerCase()),
  )
}

// Short forms that don't prefix the full name ("jn" isn't the start of "John").
// Anything that does ("matt", "1 cor", "ps") resolves by prefix below.
const ABBREVIATIONS: Record<string, string> = {
  jn: "john",
  jhn: "john",
  mt: "matthew",
  mk: "mark",
  lk: "luke",
  jas: "james",
}

function findBook(guess: string): BibleBook | undefined {
  const spaced = guess.replace(/^([1-3])\s*/, "$1 ").replace(/\.$/, "").trim()
  const numbered = spaced.match(/^([1-3] )?(.*)$/)!
  const name = `${numbered[1] ?? ""}${ABBREVIATIONS[numbered[2]] ?? numbered[2]}`
  if (numbered[2].replace(/[^a-z]/g, "").length < 2) return undefined
  return (
    allBooks.find((candidate) => candidate.name.toLowerCase() === name) ??
    allBooks.find((candidate) => candidate.name.toLowerCase().startsWith(name))
  )
}

// "John 3:16", "jn 3.16", "matt 3 1", "1cor 13", "Psalm 23v4", "Jude 3". The
// chapter and verse are clamped to what the book has.
export function parseFullScriptureReference(raw: string): ParsedScriptureReference | null {
  const match = raw
    .trim()
    .toLowerCase()
    .match(/^([1-3]?\s*[a-z][a-z .]*?)\s*(\d+)(?:\s*(?::|\.|v|\s)\s*(\d+))?$/)
  if (!match) return null
  const book = findBook(match[1])
  if (!book) return null
  // One-chapter books are cited by verse alone: "Jude 3", "3 John 4".
  const verseOnly = book.chapters.length === 1 && !match[3]
  const chapterRequested = verseOnly ? 1 : Number(match[2])
  const verseRequested = verseOnly ? Number(match[2]) : match[3] ? Number(match[3]) : undefined
  const chapter = Math.min(Math.max(chapterRequested, 1), book.chapters.length)
  const verseCount = book.chapters[chapter - 1]
  const verse =
    verseRequested !== undefined
      ? Math.min(Math.max(verseRequested, 1), verseCount)
      : undefined
  return { book, chapter, verse }
}
