// Standalone Node ESM script that scrapes the full Living Bible (TLB) from
// BibleGateway (the eightlabs and bolls APIs do not serve it) and writes it to
// public/bibles/tlb.json so the app can ship it as a baked-in offline
// translation. One request per chapter (1189 total), throttled to ~3 concurrent
// with a small delay to be polite. DO NOT run casually.
//
// BibleGateway renders each verse inside
//   <span id="en-TLB-…" class="text Book-Chap-Verse">…</span>
// The TLB frequently merges adjacent verses, in which case the class carries a
// range (e.g. "John-3-1-John-3-2"). We attribute merged text to the first verse
// number of the range, which is how the TLB reads.
//
// The Living Bible © 1971 by Tyndale House Publishers. Bundled here for
// personal, non-commercial use only.
//
// Usage: node scripts/fetch-tlb.mjs

import { writeFile, mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const BG_BASE = "https://www.biblegateway.com/passage/"
const VERSION = "TLB"
const CONCURRENCY = 3
const DELAY_MS = 150

// `name` is used in the ?search= query (full book name). `abbr` is the OSIS
// abbreviation BibleGateway uses inside the verse span class
// ("text <abbr>-<chap>-<verse>"). `chapters` is the chapter count per book.
const BOOKS = [
  { name: "Genesis", abbr: "Gen", chapters: 50 },
  { name: "Exodus", abbr: "Exod", chapters: 40 },
  { name: "Leviticus", abbr: "Lev", chapters: 27 },
  { name: "Numbers", abbr: "Num", chapters: 36 },
  { name: "Deuteronomy", abbr: "Deut", chapters: 34 },
  { name: "Joshua", abbr: "Josh", chapters: 24 },
  { name: "Judges", abbr: "Judg", chapters: 21 },
  { name: "Ruth", abbr: "Ruth", chapters: 4 },
  { name: "1 Samuel", abbr: "1Sam", chapters: 31 },
  { name: "2 Samuel", abbr: "2Sam", chapters: 24 },
  { name: "1 Kings", abbr: "1Kgs", chapters: 22 },
  { name: "2 Kings", abbr: "2Kgs", chapters: 25 },
  { name: "1 Chronicles", abbr: "1Chr", chapters: 29 },
  { name: "2 Chronicles", abbr: "2Chr", chapters: 36 },
  { name: "Ezra", abbr: "Ezra", chapters: 10 },
  { name: "Nehemiah", abbr: "Neh", chapters: 13 },
  { name: "Esther", abbr: "Esth", chapters: 10 },
  { name: "Job", abbr: "Job", chapters: 42 },
  { name: "Psalms", abbr: "Ps", chapters: 150 },
  { name: "Proverbs", abbr: "Prov", chapters: 31 },
  { name: "Ecclesiastes", abbr: "Eccl", chapters: 12 },
  { name: "Song of Solomon", abbr: "Song", chapters: 8 },
  { name: "Isaiah", abbr: "Isa", chapters: 66 },
  { name: "Jeremiah", abbr: "Jer", chapters: 52 },
  { name: "Lamentations", abbr: "Lam", chapters: 5 },
  { name: "Ezekiel", abbr: "Ezek", chapters: 48 },
  { name: "Daniel", abbr: "Dan", chapters: 12 },
  { name: "Hosea", abbr: "Hos", chapters: 14 },
  { name: "Joel", abbr: "Joel", chapters: 3 },
  { name: "Amos", abbr: "Amos", chapters: 9 },
  { name: "Obadiah", abbr: "Obad", chapters: 1 },
  { name: "Jonah", abbr: "Jonah", chapters: 4 },
  { name: "Micah", abbr: "Mic", chapters: 7 },
  { name: "Nahum", abbr: "Nah", chapters: 3 },
  { name: "Habakkuk", abbr: "Hab", chapters: 3 },
  { name: "Zephaniah", abbr: "Zeph", chapters: 3 },
  { name: "Haggai", abbr: "Hag", chapters: 2 },
  { name: "Zechariah", abbr: "Zech", chapters: 14 },
  { name: "Malachi", abbr: "Mal", chapters: 4 },
  { name: "Matthew", abbr: "Matt", chapters: 28 },
  { name: "Mark", abbr: "Mark", chapters: 16 },
  { name: "Luke", abbr: "Luke", chapters: 24 },
  { name: "John", abbr: "John", chapters: 21 },
  { name: "Acts", abbr: "Acts", chapters: 28 },
  { name: "Romans", abbr: "Rom", chapters: 16 },
  { name: "1 Corinthians", abbr: "1Cor", chapters: 16 },
  { name: "2 Corinthians", abbr: "2Cor", chapters: 13 },
  { name: "Galatians", abbr: "Gal", chapters: 6 },
  { name: "Ephesians", abbr: "Eph", chapters: 6 },
  { name: "Philippians", abbr: "Phil", chapters: 4 },
  { name: "Colossians", abbr: "Col", chapters: 4 },
  { name: "1 Thessalonians", abbr: "1Thess", chapters: 5 },
  { name: "2 Thessalonians", abbr: "2Thess", chapters: 3 },
  { name: "1 Timothy", abbr: "1Tim", chapters: 6 },
  { name: "2 Timothy", abbr: "2Tim", chapters: 4 },
  { name: "Titus", abbr: "Titus", chapters: 3 },
  { name: "Philemon", abbr: "Phlm", chapters: 1 },
  { name: "Hebrews", abbr: "Heb", chapters: 13 },
  { name: "James", abbr: "Jas", chapters: 5 },
  { name: "1 Peter", abbr: "1Pet", chapters: 5 },
  { name: "2 Peter", abbr: "2Pet", chapters: 3 },
  { name: "1 John", abbr: "1John", chapters: 5 },
  { name: "2 John", abbr: "2John", chapters: 1 },
  { name: "3 John", abbr: "3John", chapters: 1 },
  { name: "Jude", abbr: "Jude", chapters: 1 },
  { name: "Revelation", abbr: "Rev", chapters: 22 },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Decode the handful of HTML entities BibleGateway emits, and collapse space.
function decode(s) {
  return String(s)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&lsquo;/g, "‘")
    .replace(/&rsquo;/g, "’")
    .replace(/&mdash;/g, "—")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
}

// Remove footnote/cross-reference markers and chapter/verse number labels, then
// strip remaining tags to plain verse text. Class matches are tolerant of extra
// modifier classes (e.g. "versenum mid-paragraph").
function verseText(fragment) {
  return decode(
    fragment
      // drop footnote and cross-reference superscripts entirely
      .replace(/<sup[^>]*data-fn[^>]*>.*?<\/sup>/gis, "")
      .replace(/<sup[^>]*class="(?:crossreference|footnote)[^"]*"[^>]*>.*?<\/sup>/gis, "")
      // drop the leading verse / chapter number labels
      .replace(/<sup[^>]*class="versenum[^"]*"[^>]*>.*?<\/sup>/gis, "")
      .replace(/<span[^>]*class="chapternum[^"]*"[^>]*>.*?<\/span>/gis, "")
      // unwrap everything else (woj, small-caps, italics, etc.)
      .replace(/<[^>]+>/g, ""),
  )
}

async function fetchChapter(book, chapter) {
  const search = encodeURIComponent(`${book.name} ${chapter}`)
  const url = `${BG_BASE}?search=${search}&version=${VERSION}`
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    },
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  const html = await res.text()

  // Isolate the passage body so we don't pick up nav/related markup.
  const start = html.indexOf("passage-content")
  const slice = start >= 0 ? html.slice(start) : html

  const abbr = book.abbr
  // Match each verse span. The class is either "text Abbr-Chap-Verse" or a
  // range "text Abbr-Chap-V1-Abbr-Chap-V2"; capture the first verse number.
  const re = new RegExp(
    `<span[^>]*class="text ${abbr}-${chapter}-(\\d+)(?:-${abbr}-${chapter}-\\d+)?"[^>]*>([\\s\\S]*?)</span>\\s*(?=<span[^>]*class="text |</p>|<p|$)`,
    "g",
  )

  // BibleGateway sometimes emits a single verse across several spans (poetic
  // line breaks, address lines, etc.), all sharing the same verse number. Merge
  // consecutive spans with the same number so each verse is one entry.
  const verses = []
  let m
  while ((m = re.exec(slice)) !== null) {
    const number = Number(m[1])
    const text = verseText(m[2])
    if (!text) continue
    const last = verses[verses.length - 1]
    if (last && last.number === number) last.text += ` ${text}`
    else verses.push({ number, text })
  }
  if (verses.length === 0) throw new Error(`No verses parsed for ${book.name} ${chapter}`)
  return verses
}

// Build the flat list of every chapter to fetch.
const tasks = []
for (const book of BOOKS) {
  for (let c = 1; c <= book.chapters; c++) tasks.push({ book, chapter: c })
}

async function run() {
  const chapters = {}
  let done = 0
  const total = tasks.length
  const queue = [...tasks]

  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift()
      const verses = await fetchChapter(task.book, task.chapter)
      chapters[`${task.book.name}:${task.chapter}`] = verses
      done += 1
      if (done % 25 === 0 || done === total) {
        process.stdout.write(`\rfetched ${done}/${total} chapters`)
      }
      await sleep(DELAY_MS)
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  process.stdout.write("\n")

  const __dirname = dirname(fileURLToPath(import.meta.url))
  const outDir = join(__dirname, "..", "public", "bibles")
  const outPath = join(outDir, "tlb.json")
  await mkdir(outDir, { recursive: true })
  await writeFile(outPath, JSON.stringify({ version: "TLB", chapters }))
  console.log(`wrote ${outPath} (${Object.keys(chapters).length} chapters)`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
