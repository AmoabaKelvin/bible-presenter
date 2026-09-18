// Self-check for lib/voice-parse.ts. Usage: bun scripts/test-voice-parse.ts
//
// When a real service mishears something, add the transcript here first,
// then teach the parser.

import assert from "node:assert/strict"
import { parseVoiceTranscript } from "@/lib/voice-parse"

function show(text: string): string | null {
  const intent = parseVoiceTranscript(text)
  if (!intent) return null
  if (intent.type === "reference") {
    return `${intent.book.name} ${intent.chapter}${intent.verse ? `:${intent.verse}` : ""}`
  }
  if (intent.type === "verse") return `verse ${intent.verse}`
  if (intent.type === "back") return "back"
  if (intent.type === "version") return `version ${intent.code}`
  return `${intent.type} ${intent.delta > 0 ? "+1" : "-1"}`
}

const cases: [string, string | null][] = [
  // the asks
  ["Psalm 121 verse 4", "Psalms 121:4"],
  ["Psalm 2, verse 2", "Psalms 2:2"],
  ["John 1 1", "John 1:1"],
  ["John 1:1", "John 1:1"],
  ["next verse", "step +1"],
  ["previous verse", "step -1"],
  ["Okay, go to the next verse please.", "step +1"],
  ["next chapter", "chapter +1"],

  // commands as people (and recognizers) actually say them
  ["Next verse.", "step +1"],
  ["next verse please", "step +1"],
  ["Okay, can we have the next verse please?", "step +1"],
  ["let's move to the next verse", "step +1"],
  ["Next was please.", "step +1"],
  ["next first", "step +1"],
  ["previews verse", "step -1"],
  ["Next phase.", "step +1"],
  ["next base", "step +1"],
  ["Okay, next best.", "step +1"],
  ["previous phase please", "step -1"],
  ["John chapter 3 phase 16", "John 3:16"],
  ["this is the next phase", null],
  ["the next best thing", null],
  ["God has the next phase of your life planned", null],
  ["go back one verse", "step -1"],
  ["previous chapter", "chapter -1"],
  ["take me back", "back"],
  ["Okay, go back.", "back"],
  ["take us back to where we were", "back"],
  ["go back to John 3:16", "John 3:16"],
  ["in the next verse", null],
  ["what came next was a surprise to all of them there", null],
  ["we can never go back to the way things used to be before", null],

  // number words
  ["psalm one hundred and twenty one verse four", "Psalms 121:4"],
  ["psalm one twenty one verse four", "Psalms 121:4"],
  ["psalm one twenty one", "Psalms 121"],
  ["john one twenty one", "John 1:21"],
  ["psalm one nineteen verse one oh five", "Psalms 119:105"],
  ["john chapter three verse sixteen", "John 3:16"],
  ["john three sixteen", "John 3:16"],
  ["romans eight twenty-eight", "Romans 8:28"],

  // numbered + multi-word books
  ["first john four eight", "1 John 4:8"],
  ["1st Corinthians 13:4", "1 Corinthians 13:4"],
  ["second timothy chapter 3 verse 16", "2 Timothy 3:16"],
  ["one john 1 9", "1 John 1:9"],
  ["song of songs 2 verse 1", "Song of Solomon 2:1"],
  ["Revelations 3:20", "Revelation 3:20"],
  ["jude 5", "Jude 1:5"],
  ["jude verse 5", "Jude 1:5"],
  ["Philemon and verse 6", "Philemon 1:6"],
  ["John 3 and verse 16", "John 3:16"],
  // No chapter for a 21-chapter book, so this is just "verse 6" of what's open.
  ["as it was with John and verse 6 says", "verse 6"],

  // glued digits, ranges
  ["john 316", "John 3:16"],
  ["psalm 1214", "Psalms 121:4"],
  ["psalm 119", "Psalms 119"],
  ["John 3:16-18", "John 3:16"],
  ["John 1-1", "John 1:1"],
  ["1st John 4-8", "1 John 4:8"],
  ["look at verses 4-6", "verse 4"],

  // inside a sentence; last one wins
  ["let's turn to the book of John chapter 3 verse 16 tonight", "John 3:16"],
  ["we read Romans 8:28 but look at Genesis 1:1", "Genesis 1:1"],
  ["John 3 verse 16, and then verse 17", "John 3:17"],
  ["look at verse 5", "verse 5"],
  // "verse" mangled in a two-word clip
  ["Verse 3", "verse 3"],
  ["First 3", "verse 3"],
  ["Worse 7", "verse 7"],
  ["Vers 12", "verse 12"],
  ["Vos twelve", "verse 12"],
  ["Voice 4", "verse 4"],
  ["Vase 9", "verse 9"],
  ["go to verse 3", "verse 3"],
  ["the first 3 chapters of genesis", null],
  ["he was the first 3 times", null],
  ["first 3 and then we", null],

  // translation switching, in the forms the recognizer actually produces
  ["Switch to the message", "version MSG"],
  ["Chapter to the Kings James", "version KJV"],
  ["Read it in the New International Verse", "version NIV"],
  ["Switch to the new living Revelation and", "version NLT"],
  ["Use the amplified Bible", "version AMP"],
  ["Show that in the passion Revelation", "version TPT"],
  ["Switch to new Kings James", "version NKJV"],
  ["Put it in the English standard verse", "version ESV"],
  ["Switch the Revelation to the message", "version MSG"],
  ["change to KJV", "version KJV"],
  ["switch to the berean", "version BSB"],
  ["Go to the Berean", "version BSB"],
  ["turn to the king james", "version KJV"],
  ["let us go to the message", null],
  ["go to the passion", null],
  // ...and the preaching it must not mistake for an instruction
  ["In the message today God is speaking to somebody", null],
  ["The message of the cross is foolishness to them that perish", null],
  ["This is a living word for a living church", null],
  ["the message", null],
  ["let us look at the passion of the christ", null],
  ["God gave us a new living hope", null],

  // misheard book names, only accepted with a full chapter and verse
  ["Look for 18", "Luke 4:18"],
  ["Luke for 18", "Luke 4:18"],
  ["Job for 7 days he sat there", null],
  ["Look 4 18", "Luke 4:18"],
  ["Jog 121", "Job 1:21"],
  ["look at verse 5", "verse 5"],
  ["take a look", null],

  // glued digits: the shortest chapter wins, because that is the one the
  // recognizer glues ("eleven nine" comes back as "11 9")
  ["Isaiah 119", "Isaiah 1:19"],
  ["Isaiah 118", "Isaiah 1:18"],
  ["Psalm 119", "Psalms 119"],
  ["Mark 435", "Mark 4:35"],

  // mangled by the speech model
  ["johhn chapter three verse sixteen", "John 3:16"],
  ["habakkup chapter two verse four", "Habakkuk 2:4"],
  ["naham chapter one verse seven", "Nahum 1:7"],
  ["eccclesiasts three verse one", "Ecclesiastes 3:1"],
  ["first thesssaloniians five verse seventeen", "1 Thessalonians 5:17"],
  ["Ecclesias 3 verse 1", "Ecclesiastes 3:1"],
  ["song of sollomomon chapter two verse one", null],
  ["zzzzz chapter two verse four", null],

  // must do nothing
  ["Psalm 200", null],
  ["John 3:99", null],
  ["in the next verse Paul says something", null],
  ["the number 1 reason we gather", null],
  ["John said to Mark", null],
  ["", null],
]

let failed = 0
for (const [text, expected] of cases) {
  const actual = show(text)
  try {
    assert.equal(actual, expected)
  } catch {
    failed++
    console.error(`FAIL "${text}"\n  expected ${expected}\n  actual   ${actual}`)
  }
}
console.log(failed ? `${failed}/${cases.length} failed` : `ok — ${cases.length} cases`)
process.exit(failed ? 1 : 0)
