import { allBooks } from "@/lib/bible-data"

// The custom dictionary sent to the FlowCast Voice helper: words to favour
// when the audio supports them. Book names only need help when they're long
// and rare ("Habakkuk", "Philemon"); short ones ("John", "Mark", "Job") are
// everyday words the model already gets right, and boosting them would turn
// ordinary speech into book names.
const MIN_LENGTH = 5

export const voiceVocabulary: string[] = [
  ...new Set([
    ...allBooks.map((book) => book.name.split(" ").at(-1)!).filter((word) => word.length >= MIN_LENGTH),
    "Psalm",
    "chapter",
    "verse",
  ]),
]
