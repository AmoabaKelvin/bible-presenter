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

export function parseFullScriptureReference(raw: string): ParsedScriptureReference | null {
  const trimmed = raw.trim()
  const match = trimmed.match(/^([1-3]?\s?[A-Za-z .]+?)\s+(\d+)(?::(\d+))?$/)
  if (!match) return null
  const bookGuess = match[1].trim().toLowerCase()
  const chapterRequested = Number(match[2])
  const verseRequested = match[3] ? Number(match[3]) : undefined
  const book =
    allBooks.find((candidate) => candidate.name.toLowerCase() === bookGuess) ||
    allBooks.find((candidate) => candidate.name.toLowerCase().startsWith(bookGuess))
  if (!book) return null
  const chapter = Math.min(Math.max(chapterRequested, 1), book.chapters.length)
  const verseCount = book.chapters[chapter - 1]
  const verse =
    verseRequested !== undefined
      ? Math.min(Math.max(verseRequested, 1), verseCount)
      : undefined
  return { book, chapter, verse }
}
