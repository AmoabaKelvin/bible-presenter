import { allBooks, BIBLE_VERSIONS, type BibleBook } from "@/lib/bible-data"

// Turns a speech-to-text transcript into a scripture action. Pure text in,
// intent out — knows nothing about microphones or which STT engine produced
// the words. Check: bun scripts/test-voice-parse.ts

export type VoiceIntent =
  | { type: "reference"; book: BibleBook; chapter: number; verse?: number }
  // "verse 5" with no book: resolve against whatever chapter is open.
  | { type: "verse"; verse: number }
  | { type: "step"; delta: 1 | -1 }
  | { type: "chapter"; delta: 1 | -1 }
  // "go back" / "take me back": return to what was up before the last jump.
  | { type: "back" }
  // "switch to the Message": read the same place in another translation.
  | { type: "version"; code: string }

type ReferenceIntent = Extract<VoiceIntent, { type: "reference" }>

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19,
}
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
}
const BOOK_ORDINALS: Record<string, string> = { first: "1", second: "2", third: "3" }
const VERSE_MARKERS = new Set(["verse", "verses", "vs"])
const FILLERS = new Set(["and", "at", "in", "the"])

// What STT engines and preachers actually say, beyond the canonical names.
const SPOKEN_ALIASES: Record<string, string> = {
  revelations: "Revelation",
  "song of songs": "Song of Solomon",
  "songs of solomon": "Song of Solomon",
  "acts of the apostles": "Acts",
}
// What short book names actually come back as, collected from real use. Kept
// deliberately narrow rather than fuzzy-matching every 3-letter book: "like",
// "judge" and "truth" are all one edit from one. Like a fuzzy match, these are
// only accepted when a full, valid chapter and verse follows.
const HEARD_AS: Record<string, string> = {
  look: "Luke",
  luk: "Luke",
  jog: "Job",
  jobe: "Job",
  marc: "Mark",
  mach: "Mark",
  ax: "Acts",
  axe: "Acts",
  jon: "John",
}

// Singular forms are accepted ("psalm", "proverb", "1 corinthian") except
// where the singular is an everyday word ("the number 1 reason").
const NO_SINGULAR = new Set(["Numbers", "Acts", "Judges"])

const bookByAlias = new Map<string, BibleBook>()
for (const book of allBooks) {
  const name = book.name.toLowerCase()
  bookByAlias.set(name, book)
  if (name.endsWith("s") && !NO_SINGULAR.has(book.name)) bookByAlias.set(name.slice(0, -1), book)
}
for (const [alias, name] of Object.entries(SPOKEN_ALIASES)) {
  bookByAlias.set(alias, allBooks.find((b) => b.name === name)!)
}
const heardAsBook = new Map<string, BibleBook>()
for (const [heard, name] of Object.entries(HEARD_AS)) {
  heardAsBook.set(heard, allBooks.find((b) => b.name === name)!)
}
const MAX_ALIAS_TOKENS = 4

const isNumber = (token: string | undefined) => token !== undefined && /^\d+$/.test(token)
const isNumberWord = (token: string | undefined) =>
  token !== undefined && (token in UNITS || token in TENS)

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    // A hyphen after chapter:verse (or after "verse N") is a range: keep its
    // start. Any other hyphen between numbers is how Whisper writes
    // chapter-verse ("John 1-1").
    .replace(/(\d+:\d+|\bverses?\s+\d+)\s*[-–—]\s*\d+/g, "$1")
    .replace(/(\d)\s*[-–—]\s*(\d)/g, "$1 $2")
    .replace(/(\d)(?:st|nd|rd|th)\b/g, "$1")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
}

// "one hundred and twenty one" -> "121", "three sixteen" -> "3" "16".
// "one twenty one" stays "1" "21"; resolveNumbers decides if that's 121.
function wordsToDigits(tokens: string[]): string[] {
  const out: string[] = []
  let i = 0
  const belowHundred = (): number | null => {
    const t = tokens[i]
    if (t in TENS) {
      i++
      const unit = UNITS[tokens[i]]
      if (unit >= 1 && unit <= 9) {
        i++
        return TENS[t] + unit
      }
      return TENS[t]
    }
    if (t in UNITS) {
      i++
      return UNITS[t]
    }
    return null
  }
  while (i < tokens.length) {
    const t = tokens[i]
    if ((t === "oh" || t === "o") && isNumber(out[out.length - 1]) && (isNumberWord(tokens[i + 1]) || isNumber(tokens[i + 1]))) {
      out.push("0")
      i++
      continue
    }
    let value = belowHundred()
    if (value === null) {
      out.push(t)
      i++
      continue
    }
    if (value >= 1 && value <= 9 && tokens[i] === "hundred") {
      value *= 100
      i++
      if (tokens[i] === "and" && isNumberWord(tokens[i + 1])) i++
      if (isNumberWord(tokens[i])) value += belowHundred()!
    }
    out.push(String(value))
  }
  return out
}

// Spoken numbers arrive in pieces: [121], [1, 21] ("one twenty one"),
// [1, 0, 5] ("one oh five").
function combine(nums: number[]): number | null {
  if (nums.length === 1) return nums[0]
  const [a, b, c] = nums
  if (a < 1 || a > 9) return null
  if (nums.length === 2 && b >= 10 && b <= 99) return a * 100 + b
  if (nums.length === 3 && b === 0 && c >= 1 && c <= 9) return a * 100 + c
  return null
}

// Strict on purpose: a misheard "Psalm 200" must do nothing, not project
// Psalm 150 the way the typeahead's clamping would.
function isValid(book: BibleBook, chapter: number | null, verse?: number | null): chapter is number {
  if (chapter === null || chapter < 1 || chapter > book.chapters.length) return false
  if (verse === undefined) return true
  return verse !== null && verse >= 1 && verse <= book.chapters[chapter - 1]
}

type ChapterVerse = { chapter: number; verse?: number }

function resolveNumbers(book: BibleBook, chapterNums: number[], verseNums: number[] | null): ChapterVerse | null {
  if (verseNums) {
    // Explicit "verse" marker: everything before it is the chapter.
    const verse = combine(verseNums)
    const chapter = chapterNums.length === 0 && book.chapters.length === 1 ? 1 : combine(chapterNums)
    return verse !== null && isValid(book, chapter, verse) ? { chapter, verse } : null
  }
  const nums = chapterNums
  if (nums.length === 0 || nums.length > 5) return null
  // "Jude 5" is a verse, not a chapter.
  if (book.chapters.length === 1 && nums.length === 1) {
    return isValid(book, 1, nums[0]) ? { chapter: 1, verse: nums[0] } : null
  }
  for (let split = 1; split <= nums.length; split++) {
    const chapter = combine(nums.slice(0, split))
    const verse = split < nums.length ? combine(nums.slice(split)) : undefined
    if (isValid(book, chapter, verse)) return { chapter, verse: verse ?? undefined }
  }
  // The recognizer glued the digits: "john 316", "isaiah 119". Where more than
  // one split is valid (Isaiah 119 is both 1:19 and 11:9) take the shortest
  // chapter, because that is the one that gets glued: asked for 11:9 the
  // recognizer writes "isaiah 11 9" — measured, it only runs the digits
  // together when the verse is the two-digit half ("one nineteen" -> 119).
  if (nums.length === 1) {
    const digits = String(nums[0])
    for (let cut = 1; cut < digits.length; cut++) {
      const chapter = Number(digits.slice(0, cut))
      const verse = Number(digits.slice(cut))
      if (digits[cut] !== "0" && isValid(book, chapter, verse)) return { chapter, verse }
    }
  }
  return null
}

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = row
  }
  return prev[b.length]
}

// "johhn" / "matththew": some decoders stutter letters.
const squeeze = (word: string) => word.replace(/(.)\1+/g, "$1")

// Speech models mangle the rare names ("habakkup", "naham", "eccclesiasts").
// Only long names are fuzzy-matched — a typo away from "Mark" or "Acts" is
// too many ordinary words — and the caller only accepts a fuzzy book when a
// full, valid chapter-and-verse follows it.
const FUZZY_MIN_LENGTH = 5
function fuzzyBook(key: string): BibleBook | null {
  const word = squeeze(key)
  // A stutter alone ("johhn") is safe to undo at any length.
  for (const [alias, book] of bookByAlias) if (squeeze(alias) === word) return book
  // "number" stays a word, for the same reason it isn't a singular alias.
  if (word.length < FUZZY_MIN_LENGTH || [...NO_SINGULAR].some((name) => name.toLowerCase() === `${word}s`)) return null
  // A clipped name ("ecclesias") that can only be one book.
  const startsWith = [...new Set([...bookByAlias].filter(([alias]) => squeeze(alias).startsWith(word)).map(([, book]) => book))]
  if (startsWith.length === 1) return startsWith[0]
  const allowed = word.length >= 8 ? 2 : 1
  let best: BibleBook | null = null
  let bestDistance = allowed + 1
  for (const [alias, book] of bookByAlias) {
    if (alias.length < FUZZY_MIN_LENGTH || Math.abs(alias.length - word.length) > allowed) continue
    const distance = editDistance(word, squeeze(alias))
    if (distance < bestDistance) {
      best = book
      bestDistance = distance
    } else if (distance === bestDistance && best !== book) {
      best = null // two books equally close: don't guess
    }
  }
  return best
}

function matchBook(tokens: string[], at: number): { book: BibleBook; end: number; fuzzy?: boolean } | null {
  const first = BOOK_ORDINALS[tokens[at]] ?? tokens[at]
  for (let len = Math.min(MAX_ALIAS_TOKENS, tokens.length - at); len >= 1; len--) {
    const key = [first, ...tokens.slice(at + 1, at + len)].join(" ")
    const book = bookByAlias.get(key)
    if (book) return { book, end: at + len }
  }
  const heard = heardAsBook.get(tokens[at])
  if (heard) return { book: heard, end: at + 1, fuzzy: true }
  // Fuzzy: a single word, or a numbered book ("1 thesssaloniians").
  const numbered = /^[123]$/.test(first) && tokens[at + 1] !== undefined
  const word = numbered ? tokens[at + 1] : tokens[at]
  if (isNumber(word)) return null
  const book = fuzzyBook(numbered ? `${first} ${word}` : word)
  return book ? { book, end: at + (numbered ? 2 : 1), fuzzy: true } : null
}

function readNumbers(tokens: string[], at: number): { nums: number[]; end: number } {
  const nums: number[] = []
  let i = at
  while (isNumber(tokens[i])) nums.push(Number(tokens[i++]))
  return { nums, end: i }
}

// Spoken commands are short utterances that END with the instruction:
// "next verse", "okay, can we have the next verse please". Two-word clips are
// where recognizers are weakest, so "verse" is accepted in the shapes it
// actually comes back as.
const MAX_COMMAND_WORDS = 8
// How "verse" comes back from the recognizer, by accent and in two-word
// clips. Collected from real use; add to it as new ones show up.
const VERSE_SOUNDALIKES = "phase|base|best|face|vase|vest|voice|worse|worst|first|was|vers|verses|versus|birth|burst"
const STEP = /(?:^| )(next|previous|prev|previews) (verse|chapter)(?: please| now)?$/
// "next phase" is also ordinary English ("this is the next phase of your
// life"), so a sound-alike only counts when the command is the whole
// utterance, give or take a polite word.
const STEP_SOUNDALIKE = new RegExp(
  `^(?:(?:okay|ok|and|now|please|the|go to|go|move to) )*(next|previous|prev|previews) (?:${VERSE_SOUNDALIKES})(?: please| now)?$`,
)
const STEP_BACK = /(?:^| )back (?:1|a) verse(?: please| now)?$/
// "in the next verse Paul…" is a preacher describing, not asking.
const DESCRIBING = /(?:^| )(?:in|of|from|on|at) (?:the |that |this )?$/
const BACK = /(?:^| )(?:go back|take (?:me|us) back|bring (?:me|us|it) back|previous scripture|last scripture)(?: to where (?:we|i) (?:were|was))?(?: please| now)?$/

function parseCommand(tokens: string[]): VoiceIntent | null {
  if (tokens.length === 0 || tokens.length > MAX_COMMAND_WORDS) return null
  const text = tokens.join(" ")
  if (STEP_BACK.test(text)) return { type: "step", delta: -1 }
  const step = text.match(STEP)
  if (step && !DESCRIBING.test(text.slice(0, step.index! + 1))) {
    const delta = step[1] === "next" ? 1 : -1
    return { type: step[2] === "chapter" ? "chapter" : "step", delta }
  }
  const soundalike = text.match(STEP_SOUNDALIKE)
  if (soundalike) return { type: "step", delta: soundalike[1] === "next" ? 1 : -1 }
  return null
}

const VERSE_SOUNDALIKE_WORDS = new Set(VERSE_SOUNDALIKES.split("|"))
// "Luke four eighteen" comes back as "Look for 18". Only applied to a bare
// three-word reference, because "Job for 7 days" is a sentence, not Job 4:7.
const NUMBER_SOUNDALIKES: Record<string, string> = { for: "4", fore: "4", to: "2", too: "2", won: "1", ate: "8" }

// --- "switch to the Message" ------------------------------------------------
// The recognizer mangles the trailing noun ("Translation" -> "Revelation",
// "Version" -> "Verse") and even the verb ("Change" -> "Chapter"), so match on
// the translation's own words and let the rest be sloppy. Measured forms are in
// scripts/test-voice-parse.ts.
const VERSION_CUE = /(?:^| )(switch|change|chapter|swap|read|put|show|use|give|display|set|open)(?: |$)/
// "Berean" or "King James" in an utterance is only ever the translation, so a
// softer lead-in will do. "Message" and "Passion" are sermon words — "let's go
// to the message" must not change anything — so those need a real verb.
const VERSION_CUE_SOFT = /(?:^| )(go|turn|jump|back)(?: |$)/
const EVERYDAY_ALIASES = new Set(["message", "passion"])
// Trailing words to ignore, including how the recognizer mishears them.
const VERSION_TAIL = new Set([
  "version", "versions", "verse", "verses", "revelation", "translation",
  "translations", "bible", "please", "now", "and", "it", "instead",
])
// Longest first, so "new king james" wins over "king james".
const VERSION_ALIASES: [string, string][] = [
  ["new american standard", "NASB"],
  ["new revised standard", "NRSV"],
  ["contemporary english", "CEV"],
  ["holman christian standard", "HCSB"],
  ["christian standard", "CSB"],
  ["new international readers", "NIrV"],
  ["new international", "NIV"],
  ["english standard", "ESV"],
  ["revised standard", "RSV"],
  ["american standard", "ASV"],
  ["new king james", "NKJV"],
  ["new kings james", "NKJV"],
  ["amplified classic", "AMPC"],
  ["berean standard", "BSB"],
  ["young's literal", "YLT"],
  ["youngs literal", "YLT"],
  ["living bible", "TLB"],
  ["god's word", "GW"],
  ["gods word", "GW"],
  ["new living", "NLT"],
  ["king james", "KJV"],
  ["kings james", "KJV"],
  ["net bible", "NET"],
  ["amplified", "AMP"],
  ["message", "MSG"],
  ["passion", "TPT"],
  ["berean", "BSB"],
  ["tyndale", "Tyndale"],
  ["darby", "Darby"],
  // Spelled out. Rarely survives the recognizer, but free to accept.
  ...BIBLE_VERSIONS.map((v) => [v.code.toLowerCase(), v.code] as [string, string]).filter(
    // Codes that are ordinary words would fire on ordinary speech.
    ([code]) => !["net", "gw", "easy", "amp", "erv", "mev", "esv"].includes(code),
  ),
]

function parseVersionCommand(tokens: string[]): string | null {
  // Like the navigation commands: a short utterance that ends with the ask.
  if (tokens.length > MAX_COMMAND_WORDS) return null
  let end = tokens.length
  while (end > 0 && VERSION_TAIL.has(tokens[end - 1])) end--
  const text = tokens.slice(0, end).join(" ")
  for (const [alias, code] of VERSION_ALIASES) {
    if (text !== alias && !text.endsWith(` ${alias}`)) continue
    // "the message of the cross" is preaching; "switch to the message" is an
    // instruction. The verb is what separates them.
    const before = ` ${text.slice(0, text.length - alias.length)}`
    if (VERSION_CUE.test(before)) return code
    return !EVERYDAY_ALIASES.has(alias) && VERSION_CUE_SOFT.test(before) ? code : null
  }
  return null
}

export function parseVoiceTranscript(text: string): VoiceIntent | null {
  // "John 3 phase 16": between two numbers a sound-alike can only be "verse".
  const tokens = wordsToDigits(tokenize(text)).map((token, i, all) =>
    VERSE_SOUNDALIKE_WORDS.has(token) && isNumber(all[i - 1]) && isNumber(all[i + 1]) ? "verse" : token,
  )

  if (tokens.length === 3 && isNumber(tokens[2]) && NUMBER_SOUNDALIKES[tokens[1]] && matchBook(tokens, 0)) {
    tokens[1] = NUMBER_SOUNDALIKES[tokens[1]]
  }

  const command = parseCommand(tokens)
  if (command) return command

  const code = parseVersionCommand(tokens)
  if (code) return { type: "version", code }

  // References can sit anywhere in a sentence; the last one spoken wins.
  let reference: ReferenceIntent | null = null
  let last: VoiceIntent | null = null
  let i = 0
  while (i < tokens.length) {
    if (VERSE_MARKERS.has(tokens[i])) {
      const { nums, end } = readNumbers(tokens, i + 1)
      const verse = nums.length ? combine(nums) : null
      if (verse !== null && verse >= 1) {
        // "John 3 ... and verse 17" -> John 3:17, not a bare verse jump.
        // "<garbled book> chapter two verse four": the number before "verse"
        // means this belongs to a reference we failed to catch. Doing nothing
        // beats jumping to verse 4 of whatever chapter happens to be open.
        if (isNumber(tokens[i - 1]) && !reference) {
          i = Math.max(end, i + 1)
          continue
        }
        if (reference) {
          const prior: ReferenceIntent = reference
          if (isValid(prior.book, prior.chapter, verse)) last = reference = { ...prior, verse }
        } else {
          last = { type: "verse", verse }
        }
      }
      i = Math.max(end, i + 1)
      continue
    }
    const matched = matchBook(tokens, i)
    if (!matched) {
      i++
      continue
    }
    let cursor = matched.end
    if (tokens[cursor] === "chapter") cursor++
    const chapterPart = readNumbers(tokens, cursor)
    cursor = chapterPart.end
    let verseNums: number[] | null = null
    // "Philemon and verse 6": recognizers pad the gap with a small word.
    if (FILLERS.has(tokens[cursor]) && VERSE_MARKERS.has(tokens[cursor + 1])) cursor++
    if (VERSE_MARKERS.has(tokens[cursor])) {
      const versePart = readNumbers(tokens, cursor + 1)
      if (versePart.nums.length) {
        verseNums = versePart.nums
        cursor = versePart.end
      }
    }
    const resolved = resolveNumbers(matched.book, chapterPart.nums, verseNums)
    if (!resolved || (matched.fuzzy && resolved.verse === undefined)) {
      i++
      continue
    }
    last = reference = { type: "reference", book: matched.book, ...resolved }
    i = cursor
  }
  if (last) return last
  // Checked after references so "go back to John 3:16" is a reference.
  return tokens.length <= MAX_COMMAND_WORDS && BACK.test(tokens.join(" ")) ? { type: "back" } : null
}
