import { allBooks } from "@/lib/bible-data"

// The custom dictionary sent to the FlowCast Voice helper: words to favour
// when the audio supports them. Book names only need help when they're long
// and rare ("Habakkuk", "Philemon"); short ones ("John", "Mark", "Job") are
// everyday words the model already gets right, and boosting them would turn
// ordinary speech into book names.
const MIN_LENGTH = 5
// Long, but still everyday words or first names the model knows unaided.
// Boosted, they rewrote quoted scripture ("all things" -> "all Kings", "the
// wages of sin" -> "the James of sin", "hoped for" -> "Hosea for"), which cost
// a spoken quote 0.07-0.09 of its match score — enough to miss live. "Hosea"
// does come back mangled ("Hosier"); lib/voice-parse.ts HEARD_AS covers that
// where it can't touch a quote. Measured with scripts/stt-eval/quote-probe.ts.
const KNOWN_UNAIDED = new Set([
  "Genesis", "Exodus", "Numbers", "Joshua", "Judges", "Samuel", "Kings", "Esther", "Psalms", "Proverbs", "Solomon",
  "Daniel", "Hosea", "Jonah", "Matthew", "Romans", "Timothy", "Titus", "Hebrews", "James", "Peter", "Revelation",
])

export const voiceVocabulary: string[] = [
  ...new Set([
    ...allBooks
      .map((book) => book.name.split(" ").at(-1)!)
      .filter((word) => word.length >= MIN_LENGTH && !KNOWN_UNAIDED.has(word)),
    "Psalm",
    "chapter",
    "verse",
  ]),
]
