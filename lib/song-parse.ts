// Parse pasted lyrics into song slides. The primary creation path: an operator
// copies lyrics from the web and pastes them in.
//
// Rule: blank lines are slide breaks. Each blank-line-separated block becomes
// one slide, in order (the pasted order is the performance order). A leading
// section header ("[Chorus]", "Verse 2", …) is lifted into an operator-only
// label and stripped from the projected lyrics; unlabeled blocks are numbered
// "Verse 1", "Verse 2", …

import type { SongSlide } from "@/components/operator/types"
import { newId } from "@/lib/song-slides"

// A blank-line block longer than this many lines is auto-paginated into
// smaller slides — some lyric sources (e.g. LRCLIB records) return a whole song
// with no blank-line sections, which would otherwise be one unreadable slide.
const MAX_LINES_PER_SLIDE = 8
const SPLIT_CHUNK = 4

const HEADER =
  /^\s*[[(]?\s*(verse|chorus|pre[- ]?chorus|bridge|tag|intro|outro|ending|refrain|interlude|vamp)\s*(\d+)?\s*[\])\:]?\s*$/i

function titleCase(value: string): string {
  return value
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
}

function dropLeadingBlank(lines: string[]): void {
  while (lines.length && !lines[0].trim()) lines.shift()
}

// When `linesPerSlide` is a positive integer, each section paginates every N
// lines instead of the default 8/4 rule. Blank lines still split sections and
// leading section headers are still lifted into labels — only the pagination
// granularity changes. An undefined/zero/invalid value keeps the default rule.
export function parseSongLyrics(
  raw: string,
  options?: { linesPerSlide?: number },
): SongSlide[] {
  const perSlide = options?.linesPerSlide
  const fixedStep =
    typeof perSlide === "number" && Number.isInteger(perSlide) && perSlide > 0
      ? perSlide
      : 0

  const text = raw.replace(/\r\n?/g, "\n")
  const blocks = text.split(/\n[ \t]*\n+/)
  const slides: SongSlide[] = []
  let verseCount = 0

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.replace(/\s+$/, ""))
    dropLeadingBlank(lines)
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
    if (!lines.length) continue

    let label = ""
    const match = lines[0].match(HEADER)
    if (match) {
      const word = titleCase(match[1])
      label = match[2] ? `${word} ${match[2]}` : word
      lines.shift()
      dropLeadingBlank(lines)
    }
    if (!lines.length) continue // header with no lyrics under it

    if (!label) {
      verseCount += 1
      label = `Verse ${verseCount}`
    }

    // With a fixed lines-per-slide, paginate every N lines; otherwise long
    // sections (e.g. blank-line-free LRCLIB records) split into chunks.
    const step = fixedStep
      ? fixedStep
      : lines.length <= MAX_LINES_PER_SLIDE
        ? lines.length
        : SPLIT_CHUNK
    for (let i = 0; i < lines.length; i += step) {
      slides.push({ id: newId("ss"), label, lines: lines.slice(i, i + step) })
    }
  }

  return slides
}

// Default a song's title to its first lyric line when none was provided.
export function deriveTitle(slides: SongSlide[]): string {
  for (const slide of slides) {
    for (const line of slide.lines) {
      if (line.trim()) return line.trim()
    }
  }
  return "Untitled song"
}
