// Standalone Node ESM script that downloads the full KJV Bible (apiId
// "englishkj") from the eightlabs API and writes it to public/bibles/kjv.json
// so the app can ship a baked-in offline translation. No app imports — the
// book list and chapter counts are inlined below. Throttled to ~6 concurrent
// chapter fetches. DO NOT run casually: it makes ~1189 network requests.
//
// Usage: node scripts/fetch-kjv.mjs

import { writeFile, mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const BIBLE_API_BASE = "https://bible-api.eightlabs.xyz"
const KJV_API_ID = "englishkj"
const CONCURRENCY = 6

// book name -> { apiId, chapters: [verseCount per chapter] }
const BOOKS = [
  { name: "Genesis", apiId: "gen", chapters: [31, 25, 24, 26, 32, 22, 24, 22, 29, 32, 32, 20, 18, 24, 21, 16, 27, 33, 38, 18, 34, 24, 20, 67, 34, 35, 46, 22, 35, 43, 55, 32, 20, 31, 29, 43, 36, 30, 23, 23, 57, 38, 34, 34, 28, 34, 31, 22, 33, 26] },
  { name: "Exodus", apiId: "exo", chapters: [22, 25, 22, 31, 23, 30, 25, 32, 35, 29, 10, 51, 22, 31, 27, 36, 16, 27, 25, 26, 36, 31, 33, 18, 40, 37, 21, 43, 46, 38, 18, 35, 23, 35, 35, 38, 29, 31, 43, 38] },
  { name: "Leviticus", apiId: "lev", chapters: [17, 16, 17, 35, 19, 30, 38, 36, 24, 20, 47, 8, 59, 57, 33, 34, 16, 30, 37, 27, 24, 33, 44, 23, 55, 46, 34] },
  { name: "Numbers", apiId: "num", chapters: [54, 34, 51, 49, 31, 27, 89, 26, 23, 36, 35, 16, 33, 45, 41, 50, 13, 32, 22, 29, 35, 41, 30, 25, 18, 65, 23, 31, 40, 16, 54, 42, 56, 29, 34, 13] },
  { name: "Deuteronomy", apiId: "deu", chapters: [46, 37, 29, 49, 33, 25, 26, 20, 29, 22, 32, 32, 18, 29, 23, 22, 20, 22, 21, 20, 23, 30, 25, 22, 19, 19, 26, 68, 29, 20, 30, 52, 29, 12] },
  { name: "Joshua", apiId: "jos", chapters: [18, 24, 17, 24, 15, 27, 26, 35, 27, 43, 23, 24, 33, 15, 63, 10, 18, 28, 51, 9, 45, 34, 16, 33] },
  { name: "Judges", apiId: "jdg", chapters: [36, 23, 31, 24, 31, 40, 25, 35, 57, 18, 40, 15, 25, 20, 20, 31, 13, 31, 30, 48, 25] },
  { name: "Ruth", apiId: "rut", chapters: [22, 23, 18, 22] },
  { name: "1 Samuel", apiId: "1sa", chapters: [28, 36, 21, 22, 12, 21, 17, 22, 27, 27, 15, 25, 23, 52, 35, 23, 58, 30, 24, 42, 15, 23, 29, 22, 44, 25, 12, 25, 11, 31, 13] },
  { name: "2 Samuel", apiId: "2sa", chapters: [27, 32, 39, 12, 25, 23, 29, 18, 13, 19, 27, 31, 39, 33, 37, 23, 29, 33, 43, 26, 22, 51, 39, 25] },
  { name: "1 Kings", apiId: "1ki", chapters: [53, 46, 28, 34, 18, 38, 51, 66, 28, 29, 43, 33, 34, 31, 34, 34, 24, 46, 21, 43, 29, 53] },
  { name: "2 Kings", apiId: "2ki", chapters: [18, 25, 27, 44, 27, 33, 20, 29, 37, 36, 21, 21, 25, 29, 38, 20, 41, 37, 37, 21, 26, 20, 37, 20, 30] },
  { name: "1 Chronicles", apiId: "1ch", chapters: [54, 55, 24, 43, 26, 81, 40, 40, 44, 14, 47, 40, 14, 17, 29, 43, 27, 17, 19, 8, 30, 19, 32, 31, 31, 32, 34, 21, 30] },
  { name: "2 Chronicles", apiId: "2ch", chapters: [17, 18, 17, 22, 14, 42, 22, 18, 31, 19, 23, 16, 22, 15, 19, 14, 19, 34, 11, 37, 20, 12, 21, 27, 28, 23, 9, 27, 36, 27, 21, 33, 25, 33, 27, 23] },
  { name: "Ezra", apiId: "ezr", chapters: [11, 70, 13, 24, 17, 22, 28, 36, 15, 44] },
  { name: "Nehemiah", apiId: "neh", chapters: [11, 20, 32, 23, 19, 19, 73, 18, 38, 39, 36, 47, 31] },
  { name: "Esther", apiId: "est", chapters: [22, 23, 15, 17, 14, 14, 10, 17, 32, 3] },
  { name: "Job", apiId: "job", chapters: [22, 13, 26, 21, 27, 30, 21, 22, 35, 22, 20, 25, 28, 22, 35, 22, 16, 21, 29, 29, 34, 30, 17, 25, 6, 14, 23, 28, 25, 31, 40, 22, 33, 37, 16, 33, 24, 41, 30, 24, 34, 17] },
  { name: "Psalms", apiId: "psa", chapters: [6, 12, 8, 8, 12, 10, 17, 9, 20, 18, 7, 8, 6, 7, 5, 11, 15, 50, 14, 9, 13, 31, 6, 10, 22, 12, 14, 9, 11, 12, 24, 11, 22, 22, 28, 12, 40, 22, 13, 17, 13, 11, 5, 26, 17, 11, 9, 14, 20, 23, 19, 9, 6, 7, 23, 13, 11, 11, 17, 12, 8, 12, 11, 10, 13, 20, 7, 35, 36, 5, 24, 20, 28, 23, 10, 12, 20, 72, 13, 19, 16, 8, 18, 12, 13, 17, 7, 18, 52, 17, 16, 15, 5, 23, 11, 13, 12, 9, 9, 5, 8, 28, 22, 35, 45, 48, 43, 13, 31, 7, 10, 10, 9, 8, 18, 19, 2, 29, 176, 7, 8, 9, 4, 8, 5, 6, 5, 6, 8, 8, 3, 18, 3, 3, 21, 26, 9, 8, 24, 13, 10, 7, 12, 15, 21, 10, 20, 14, 9, 6] },
  { name: "Proverbs", apiId: "pro", chapters: [33, 22, 35, 27, 23, 35, 27, 36, 18, 32, 31, 28, 25, 35, 33, 33, 28, 24, 29, 30, 31, 29, 35, 34, 28, 28, 27, 28, 27, 33, 31] },
  { name: "Ecclesiastes", apiId: "ecc", chapters: [18, 26, 22, 16, 20, 12, 29, 17, 18, 20, 10, 14] },
  { name: "Song of Solomon", apiId: "sng", chapters: [17, 17, 11, 16, 16, 13, 13, 14] },
  { name: "Isaiah", apiId: "isa", chapters: [31, 22, 26, 6, 30, 13, 25, 22, 21, 34, 16, 6, 22, 32, 9, 14, 14, 7, 25, 6, 17, 25, 18, 23, 12, 21, 13, 29, 24, 33, 9, 20, 24, 17, 10, 22, 38, 22, 8, 31, 29, 25, 28, 28, 25, 13, 15, 22, 26, 11, 23, 15, 12, 17, 13, 12, 21, 14, 21, 22, 11, 12, 19, 12, 25, 24] },
  { name: "Jeremiah", apiId: "jer", chapters: [19, 37, 25, 31, 31, 30, 34, 22, 26, 25, 23, 17, 27, 22, 21, 21, 27, 23, 15, 18, 14, 30, 40, 10, 38, 24, 22, 17, 32, 24, 40, 44, 26, 22, 19, 32, 21, 28, 18, 16, 18, 22, 13, 30, 5, 28, 7, 47, 39, 46, 64, 34] },
  { name: "Lamentations", apiId: "lam", chapters: [22, 22, 66, 22, 22] },
  { name: "Ezekiel", apiId: "ezk", chapters: [28, 10, 27, 17, 17, 14, 27, 18, 11, 22, 25, 28, 23, 23, 8, 63, 24, 32, 14, 49, 32, 31, 49, 27, 17, 21, 36, 26, 21, 26, 18, 32, 33, 31, 15, 38, 28, 23, 29, 49, 26, 20, 27, 31, 25, 24, 23, 35] },
  { name: "Daniel", apiId: "dan", chapters: [21, 49, 30, 37, 31, 28, 28, 27, 27, 21, 45, 13] },
  { name: "Hosea", apiId: "hos", chapters: [11, 23, 5, 19, 15, 11, 16, 14, 17, 15, 12, 14, 16, 9] },
  { name: "Joel", apiId: "jol", chapters: [20, 32, 21] },
  { name: "Amos", apiId: "amo", chapters: [15, 16, 15, 13, 27, 14, 17, 14, 15] },
  { name: "Obadiah", apiId: "oba", chapters: [21] },
  { name: "Jonah", apiId: "jon", chapters: [17, 10, 10, 11] },
  { name: "Micah", apiId: "mic", chapters: [16, 13, 12, 13, 15, 16, 20] },
  { name: "Nahum", apiId: "nam", chapters: [15, 13, 19] },
  { name: "Habakkuk", apiId: "hab", chapters: [17, 20, 19] },
  { name: "Zephaniah", apiId: "zep", chapters: [18, 15, 20] },
  { name: "Haggai", apiId: "hag", chapters: [15, 23] },
  { name: "Zechariah", apiId: "zec", chapters: [21, 13, 10, 14, 11, 15, 14, 23, 17, 12, 17, 14, 9, 21] },
  { name: "Malachi", apiId: "mal", chapters: [14, 17, 18, 6] },
  { name: "Matthew", apiId: "mat", chapters: [25, 23, 17, 25, 48, 34, 29, 34, 38, 42, 30, 50, 58, 36, 39, 28, 27, 35, 30, 34, 46, 46, 39, 51, 46, 75, 66, 20] },
  { name: "Mark", apiId: "mrk", chapters: [45, 28, 35, 41, 43, 56, 37, 38, 50, 52, 33, 44, 37, 72, 47, 20] },
  { name: "Luke", apiId: "luk", chapters: [80, 52, 38, 44, 39, 49, 50, 56, 62, 42, 54, 59, 35, 35, 32, 31, 37, 43, 48, 47, 38, 71, 56, 53] },
  { name: "John", apiId: "jhn", chapters: [51, 25, 36, 54, 47, 71, 53, 59, 41, 42, 57, 50, 38, 31, 27, 33, 26, 40, 42, 31, 25] },
  { name: "Acts", apiId: "act", chapters: [26, 47, 26, 37, 42, 15, 60, 40, 43, 48, 30, 25, 52, 28, 41, 40, 34, 28, 41, 38, 40, 30, 35, 27, 27, 32, 44, 31] },
  { name: "Romans", apiId: "rom", chapters: [32, 29, 31, 25, 21, 23, 25, 39, 33, 21, 36, 21, 14, 23, 33, 27] },
  { name: "1 Corinthians", apiId: "1co", chapters: [31, 16, 23, 21, 13, 20, 40, 13, 27, 33, 34, 31, 13, 40, 58, 24] },
  { name: "2 Corinthians", apiId: "2co", chapters: [24, 17, 18, 18, 21, 18, 16, 24, 15, 18, 33, 21, 14] },
  { name: "Galatians", apiId: "gal", chapters: [24, 21, 29, 31, 26, 18] },
  { name: "Ephesians", apiId: "eph", chapters: [23, 22, 21, 32, 33, 24] },
  { name: "Philippians", apiId: "php", chapters: [30, 30, 21, 23] },
  { name: "Colossians", apiId: "col", chapters: [29, 23, 25, 18] },
  { name: "1 Thessalonians", apiId: "1th", chapters: [10, 20, 13, 18, 28] },
  { name: "2 Thessalonians", apiId: "2th", chapters: [12, 17, 18] },
  { name: "1 Timothy", apiId: "1ti", chapters: [20, 15, 16, 16, 25, 21] },
  { name: "2 Timothy", apiId: "2ti", chapters: [18, 26, 17, 22] },
  { name: "Titus", apiId: "tit", chapters: [16, 15, 15] },
  { name: "Philemon", apiId: "phm", chapters: [25] },
  { name: "Hebrews", apiId: "heb", chapters: [14, 18, 19, 16, 14, 20, 28, 13, 28, 39, 40, 29, 25] },
  { name: "James", apiId: "jas", chapters: [27, 26, 18, 17, 20] },
  { name: "1 Peter", apiId: "1pe", chapters: [25, 25, 22, 19, 14] },
  { name: "2 Peter", apiId: "2pe", chapters: [21, 22, 18] },
  { name: "1 John", apiId: "1jn", chapters: [10, 29, 24, 21, 21] },
  { name: "2 John", apiId: "2jn", chapters: [13] },
  { name: "3 John", apiId: "3jn", chapters: [14] },
  { name: "Jude", apiId: "jud", chapters: [25] },
  { name: "Revelation", apiId: "rev", chapters: [20, 29, 22, 11, 14, 17, 17, 13, 21, 11, 19, 17, 18, 20, 8, 21, 18, 24, 21, 15, 27, 21] },
]

// Build the flat list of every chapter to fetch.
const tasks = []
for (const book of BOOKS) {
  book.chapters.forEach((verseCount, i) => {
    tasks.push({ book: book.name, apiId: book.apiId, chapter: i + 1, verseCount })
  })
}

async function fetchChapter(task) {
  const { apiId, chapter, verseCount } = task
  const url = `${BIBLE_API_BASE}/verses/${apiId}.${chapter}.1-${verseCount}?translation=${KJV_API_ID}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  const data = await res.json()
  if (Array.isArray(data.verses)) {
    return data.verses.map((v) => ({ number: v.number, text: v.text }))
  }
  // Single-verse chapter: API returns { text } with no verses array.
  return [{ number: 1, text: data.text }]
}

async function run() {
  const chapters = {}
  let done = 0
  const total = tasks.length
  const queue = [...tasks]

  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift()
      const verses = await fetchChapter(task)
      chapters[`${task.book}:${task.chapter}`] = verses
      done += 1
      if (done % 25 === 0 || done === total) {
        process.stdout.write(`\rfetched ${done}/${total} chapters`)
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  process.stdout.write("\n")

  const __dirname = dirname(fileURLToPath(import.meta.url))
  const outDir = join(__dirname, "..", "public", "bibles")
  const outPath = join(outDir, "kjv.json")
  await mkdir(outDir, { recursive: true })
  await writeFile(outPath, JSON.stringify({ version: "KJV", chapters }))
  console.log(`wrote ${outPath} (${Object.keys(chapters).length} chapters)`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
