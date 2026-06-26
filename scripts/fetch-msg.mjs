// Standalone Node ESM script that downloads the full The Message (MSG)
// translation from the bolls.life Bible API (translation "MSG" — "The Message,
// 2002") and writes it to public/bibles/msg.json so the app can ship it as a
// baked-in offline translation. The eightlabs API does not serve The Message,
// so this alternate source is used. bolls.life serves MSG already split into
// standard per-verse versification, so no merged-range handling is needed. One
// request per chapter (1189 total), throttled to ~6 concurrent. DO NOT run
// casually.
//
// bolls.life returns a chapter as a JSON array of { pk, verse, text } objects,
// keyed by a numeric book id (1 = Genesis … 66 = Revelation, standard
// Protestant order). We map our book names to those ids below.
//
// The Message © 1993, 2002, 2018 by Eugene H. Peterson, published by NavPress.
// Bundled here for personal, non-commercial use only.
//
// Usage: node scripts/fetch-msg.mjs

import { writeFile, mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const BOLLS_BASE = "https://bolls.life"
const TRANSLATION = "MSG"
const CONCURRENCY = 6

// book name -> { num: bolls book id, chapters: [verseCount per chapter] }
const BOOKS = [
  { name: "Genesis", num: 1, chapters: [31, 25, 24, 26, 32, 22, 24, 22, 29, 32, 32, 20, 18, 24, 21, 16, 27, 33, 38, 18, 34, 24, 20, 67, 34, 35, 46, 22, 35, 43, 55, 32, 20, 31, 29, 43, 36, 30, 23, 23, 57, 38, 34, 34, 28, 34, 31, 22, 33, 26] },
  { name: "Exodus", num: 2, chapters: [22, 25, 22, 31, 23, 30, 25, 32, 35, 29, 10, 51, 22, 31, 27, 36, 16, 27, 25, 26, 36, 31, 33, 18, 40, 37, 21, 43, 46, 38, 18, 35, 23, 35, 35, 38, 29, 31, 43, 38] },
  { name: "Leviticus", num: 3, chapters: [17, 16, 17, 35, 19, 30, 38, 36, 24, 20, 47, 8, 59, 57, 33, 34, 16, 30, 37, 27, 24, 33, 44, 23, 55, 46, 34] },
  { name: "Numbers", num: 4, chapters: [54, 34, 51, 49, 31, 27, 89, 26, 23, 36, 35, 16, 33, 45, 41, 50, 13, 32, 22, 29, 35, 41, 30, 25, 18, 65, 23, 31, 40, 16, 54, 42, 56, 29, 34, 13] },
  { name: "Deuteronomy", num: 5, chapters: [46, 37, 29, 49, 33, 25, 26, 20, 29, 22, 32, 32, 18, 29, 23, 22, 20, 22, 21, 20, 23, 30, 25, 22, 19, 19, 26, 68, 29, 20, 30, 52, 29, 12] },
  { name: "Joshua", num: 6, chapters: [18, 24, 17, 24, 15, 27, 26, 35, 27, 43, 23, 24, 33, 15, 63, 10, 18, 28, 51, 9, 45, 34, 16, 33] },
  { name: "Judges", num: 7, chapters: [36, 23, 31, 24, 31, 40, 25, 35, 57, 18, 40, 15, 25, 20, 20, 31, 13, 31, 30, 48, 25] },
  { name: "Ruth", num: 8, chapters: [22, 23, 18, 22] },
  { name: "1 Samuel", num: 9, chapters: [28, 36, 21, 22, 12, 21, 17, 22, 27, 27, 15, 25, 23, 52, 35, 23, 58, 30, 24, 42, 15, 23, 29, 22, 44, 25, 12, 25, 11, 31, 13] },
  { name: "2 Samuel", num: 10, chapters: [27, 32, 39, 12, 25, 23, 29, 18, 13, 19, 27, 31, 39, 33, 37, 23, 29, 33, 43, 26, 22, 51, 39, 25] },
  { name: "1 Kings", num: 11, chapters: [53, 46, 28, 34, 18, 38, 51, 66, 28, 29, 43, 33, 34, 31, 34, 34, 24, 46, 21, 43, 29, 53] },
  { name: "2 Kings", num: 12, chapters: [18, 25, 27, 44, 27, 33, 20, 29, 37, 36, 21, 21, 25, 29, 38, 20, 41, 37, 37, 21, 26, 20, 37, 20, 30] },
  { name: "1 Chronicles", num: 13, chapters: [54, 55, 24, 43, 26, 81, 40, 40, 44, 14, 47, 40, 14, 17, 29, 43, 27, 17, 19, 8, 30, 19, 32, 31, 31, 32, 34, 21, 30] },
  { name: "2 Chronicles", num: 14, chapters: [17, 18, 17, 22, 14, 42, 22, 18, 31, 19, 23, 16, 22, 15, 19, 14, 19, 34, 11, 37, 20, 12, 21, 27, 28, 23, 9, 27, 36, 27, 21, 33, 25, 33, 27, 23] },
  { name: "Ezra", num: 15, chapters: [11, 70, 13, 24, 17, 22, 28, 36, 15, 44] },
  { name: "Nehemiah", num: 16, chapters: [11, 20, 32, 23, 19, 19, 73, 18, 38, 39, 36, 47, 31] },
  { name: "Esther", num: 17, chapters: [22, 23, 15, 17, 14, 14, 10, 17, 32, 3] },
  { name: "Job", num: 18, chapters: [22, 13, 26, 21, 27, 30, 21, 22, 35, 22, 20, 25, 28, 22, 35, 22, 16, 21, 29, 29, 34, 30, 17, 25, 6, 14, 23, 28, 25, 31, 40, 22, 33, 37, 16, 33, 24, 41, 30, 24, 34, 17] },
  { name: "Psalms", num: 19, chapters: [6, 12, 8, 8, 12, 10, 17, 9, 20, 18, 7, 8, 6, 7, 5, 11, 15, 50, 14, 9, 13, 31, 6, 10, 22, 12, 14, 9, 11, 12, 24, 11, 22, 22, 28, 12, 40, 22, 13, 17, 13, 11, 5, 26, 17, 11, 9, 14, 20, 23, 19, 9, 6, 7, 23, 13, 11, 11, 17, 12, 8, 12, 11, 10, 13, 20, 7, 35, 36, 5, 24, 20, 28, 23, 10, 12, 20, 72, 13, 19, 16, 8, 18, 12, 13, 17, 7, 18, 52, 17, 16, 15, 5, 23, 11, 13, 12, 9, 9, 5, 8, 28, 22, 35, 45, 48, 43, 13, 31, 7, 10, 10, 9, 8, 18, 19, 2, 29, 176, 7, 8, 9, 4, 8, 5, 6, 5, 6, 8, 8, 3, 18, 3, 3, 21, 26, 9, 8, 24, 13, 10, 7, 12, 15, 21, 10, 20, 14, 9, 6] },
  { name: "Proverbs", num: 20, chapters: [33, 22, 35, 27, 23, 35, 27, 36, 18, 32, 31, 28, 25, 35, 33, 33, 28, 24, 29, 30, 31, 29, 35, 34, 28, 28, 27, 28, 27, 33, 31] },
  { name: "Ecclesiastes", num: 21, chapters: [18, 26, 22, 16, 20, 12, 29, 17, 18, 20, 10, 14] },
  { name: "Song of Solomon", num: 22, chapters: [17, 17, 11, 16, 16, 13, 13, 14] },
  { name: "Isaiah", num: 23, chapters: [31, 22, 26, 6, 30, 13, 25, 22, 21, 34, 16, 6, 22, 32, 9, 14, 14, 7, 25, 6, 17, 25, 18, 23, 12, 21, 13, 29, 24, 33, 9, 20, 24, 17, 10, 22, 38, 22, 8, 31, 29, 25, 28, 28, 25, 13, 15, 22, 26, 11, 23, 15, 12, 17, 13, 12, 21, 14, 21, 22, 11, 12, 19, 12, 25, 24] },
  { name: "Jeremiah", num: 24, chapters: [19, 37, 25, 31, 31, 30, 34, 22, 26, 25, 23, 17, 27, 22, 21, 21, 27, 23, 15, 18, 14, 30, 40, 10, 38, 24, 22, 17, 32, 24, 40, 44, 26, 22, 19, 32, 21, 28, 18, 16, 18, 22, 13, 30, 5, 28, 7, 47, 39, 46, 64, 34] },
  { name: "Lamentations", num: 25, chapters: [22, 22, 66, 22, 22] },
  { name: "Ezekiel", num: 26, chapters: [28, 10, 27, 17, 17, 14, 27, 18, 11, 22, 25, 28, 23, 23, 8, 63, 24, 32, 14, 49, 32, 31, 49, 27, 17, 21, 36, 26, 21, 26, 18, 32, 33, 31, 15, 38, 28, 23, 29, 49, 26, 20, 27, 31, 25, 24, 23, 35] },
  { name: "Daniel", num: 27, chapters: [21, 49, 30, 37, 31, 28, 28, 27, 27, 21, 45, 13] },
  { name: "Hosea", num: 28, chapters: [11, 23, 5, 19, 15, 11, 16, 14, 17, 15, 12, 14, 16, 9] },
  { name: "Joel", num: 29, chapters: [20, 32, 21] },
  { name: "Amos", num: 30, chapters: [15, 16, 15, 13, 27, 14, 17, 14, 15] },
  { name: "Obadiah", num: 31, chapters: [21] },
  { name: "Jonah", num: 32, chapters: [17, 10, 10, 11] },
  { name: "Micah", num: 33, chapters: [16, 13, 12, 13, 15, 16, 20] },
  { name: "Nahum", num: 34, chapters: [15, 13, 19] },
  { name: "Habakkuk", num: 35, chapters: [17, 20, 19] },
  { name: "Zephaniah", num: 36, chapters: [18, 15, 20] },
  { name: "Haggai", num: 37, chapters: [15, 23] },
  { name: "Zechariah", num: 38, chapters: [21, 13, 10, 14, 11, 15, 14, 23, 17, 12, 17, 14, 9, 21] },
  { name: "Malachi", num: 39, chapters: [14, 17, 18, 6] },
  { name: "Matthew", num: 40, chapters: [25, 23, 17, 25, 48, 34, 29, 34, 38, 42, 30, 50, 58, 36, 39, 28, 27, 35, 30, 34, 46, 46, 39, 51, 46, 75, 66, 20] },
  { name: "Mark", num: 41, chapters: [45, 28, 35, 41, 43, 56, 37, 38, 50, 52, 33, 44, 37, 72, 47, 20] },
  { name: "Luke", num: 42, chapters: [80, 52, 38, 44, 39, 49, 50, 56, 62, 42, 54, 59, 35, 35, 32, 31, 37, 43, 48, 47, 38, 71, 56, 53] },
  { name: "John", num: 43, chapters: [51, 25, 36, 54, 47, 71, 53, 59, 41, 42, 57, 50, 38, 31, 27, 33, 26, 40, 42, 31, 25] },
  { name: "Acts", num: 44, chapters: [26, 47, 26, 37, 42, 15, 60, 40, 43, 48, 30, 25, 52, 28, 41, 40, 34, 28, 41, 38, 40, 30, 35, 27, 27, 32, 44, 31] },
  { name: "Romans", num: 45, chapters: [32, 29, 31, 25, 21, 23, 25, 39, 33, 21, 36, 21, 14, 23, 33, 27] },
  { name: "1 Corinthians", num: 46, chapters: [31, 16, 23, 21, 13, 20, 40, 13, 27, 33, 34, 31, 13, 40, 58, 24] },
  { name: "2 Corinthians", num: 47, chapters: [24, 17, 18, 18, 21, 18, 16, 24, 15, 18, 33, 21, 14] },
  { name: "Galatians", num: 48, chapters: [24, 21, 29, 31, 26, 18] },
  { name: "Ephesians", num: 49, chapters: [23, 22, 21, 32, 33, 24] },
  { name: "Philippians", num: 50, chapters: [30, 30, 21, 23] },
  { name: "Colossians", num: 51, chapters: [29, 23, 25, 18] },
  { name: "1 Thessalonians", num: 52, chapters: [10, 20, 13, 18, 28] },
  { name: "2 Thessalonians", num: 53, chapters: [12, 17, 18] },
  { name: "1 Timothy", num: 54, chapters: [20, 15, 16, 16, 25, 21] },
  { name: "2 Timothy", num: 55, chapters: [18, 26, 17, 22] },
  { name: "Titus", num: 56, chapters: [16, 15, 15] },
  { name: "Philemon", num: 57, chapters: [25] },
  { name: "Hebrews", num: 58, chapters: [14, 18, 19, 16, 14, 20, 28, 13, 28, 39, 40, 29, 25] },
  { name: "James", num: 59, chapters: [27, 26, 18, 17, 20] },
  { name: "1 Peter", num: 60, chapters: [25, 25, 22, 19, 14] },
  { name: "2 Peter", num: 61, chapters: [21, 22, 18] },
  { name: "1 John", num: 62, chapters: [10, 29, 24, 21, 21] },
  { name: "2 John", num: 63, chapters: [13] },
  { name: "3 John", num: 64, chapters: [14] },
  { name: "Jude", num: 65, chapters: [25] },
  { name: "Revelation", num: 66, chapters: [20, 29, 22, 11, 14, 17, 17, 13, 21, 11, 19, 17, 18, 20, 8, 21, 18, 24, 21, 15, 27, 21] },
]

// Strip the HTML markup bolls.life embeds in verse text (footnote markers,
// <br>, italics, etc.) down to plain text. Footnotes are <sup>[n]</sup>, so the
// whole <sup> element (marker included) is dropped before the generic
// tag-stripping pass.
function clean(html) {
  return String(html)
    .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
}

// Build the flat list of every chapter to fetch.
const tasks = []
for (const book of BOOKS) {
  book.chapters.forEach((_verseCount, i) => {
    tasks.push({ book: book.name, num: book.num, chapter: i + 1 })
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Fetch with a few retries + backoff: bolls.life occasionally returns a
// transient error / rate-limits under 6-way concurrency across 1189 chapters.
async function fetchChapter(task, attempt = 0) {
  const { num, chapter } = task
  const url = `${BOLLS_BASE}/get-chapter/${TRANSLATION}/${num}/${chapter}/`
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
    const data = await res.json()
    if (!Array.isArray(data)) throw new Error(`Unexpected payload for ${url}`)
    return data.map((v) => ({ number: v.verse, text: clean(v.text) }))
  } catch (err) {
    if (attempt >= 4) throw err
    await sleep(500 * (attempt + 1))
    return fetchChapter(task, attempt + 1)
  }
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
  const outPath = join(outDir, "msg.json")
  await mkdir(outDir, { recursive: true })
  await writeFile(outPath, JSON.stringify({ version: "MSG", chapters }))
  console.log(`wrote ${outPath} (${Object.keys(chapters).length} chapters)`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
