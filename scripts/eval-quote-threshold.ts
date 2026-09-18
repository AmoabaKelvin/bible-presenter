// Checks voice quote detection (lib/voice-quote.ts) against a preacher quoting
// scripture (must find the right verse) and a preacher just talking (must
// stay silent). Runs the real matching code over the real indexes.
//
// Usage: bun scripts/eval-quote-threshold.ts

import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { pipeline } from "@huggingface/transformers"
import { pickQuote, stripLeadIn, type VerseIndex } from "@/lib/voice-quote"

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "bibles", "embeddings")
const meta = JSON.parse(await readFile(join(dir, "meta.json"), "utf8"))
// Mirrors the runtime: a blob over Cloudflare's asset cap ships as parts.
async function readVectors(path: string): Promise<Buffer> {
  try {
    return await readFile(path)
  } catch {
    const parts: Buffer[] = []
    for (let part = 0; ; part++) {
      try {
        parts.push(await readFile(`${path}.part${part}`))
      } catch {
        break
      }
    }
    if (parts.length === 0) throw new Error(`missing ${path}`)
    return Buffer.concat(parts)
  }
}

const indexes: VerseIndex[] = []
for (const version of ["bsb", "kjv", "niv"]) {
  try {
    const index: VerseIndex = {
      vectors: new Int8Array((await readFile(join(dir, `${version}.bin`))).buffer),
      refs: JSON.parse(await readFile(join(dir, `${version}.refs.json`), "utf8")),
    }
    try {
      const vectors = new Int8Array((await readVectors(join(dir, `${version}.phrases.bin`))).buffer)
      const offsets = new Uint32Array((await readFile(join(dir, `${version}.phrases.idx`))).buffer)
      index.phrases = { vectors, offsets }
    } catch {
      console.log(`(no ${version} phrase index)`)
    }
    indexes.push(index)
  } catch {
    console.log(`(no ${version} index)`)
  }
}
const extractor = await pipeline("feature-extraction", meta.model)

// As a recognizer would hand them over: no punctuation, often with a lead-in.
const quotes = [
  ["that's why the bible says eyes have not seen ears have not heard", ["1 Corinthians 2:9", "Isaiah 64:4"]],
  ["the lord is my shepherd i shall not want", ["Psalms 23:1"]],
  ["for god so loved the world that he gave his only begotten son", ["John 3:16"]],
  ["the bible says thy word is a lamp unto my feet and a light unto my path", ["Psalms 119:105"]],
  ["now faith is the substance of things hoped for the evidence of things not seen", ["Hebrews 11:1"]],
  ["trust in the lord with all thine heart and lean not unto thine own understanding", ["Proverbs 3:5"]],
  ["i will lift up mine eyes unto the hills from whence cometh my help", ["Psalms 121:1"]],
  ["it is written man shall not live by bread alone", ["Matthew 4:4", "Luke 4:4", "Deuteronomy 8:3"]],
  ["he that dwelleth in the secret place of the most high shall abide under the shadow of the almighty", ["Psalms 91:1"]],
  ["i can do all things through christ which strengtheneth me", ["Philippians 4:13"]],
  ["but they that wait upon the lord shall renew their strength", ["Isaiah 40:31"]],
  ["where there is no vision the people perish", ["Proverbs 29:18"]],
  ["greater love hath no man than this that a man lay down his life for his friends", ["John 15:13"]],
  ["the wages of sin is death but the gift of god is eternal life", ["Romans 6:23"]],
  ["and we know that all things work together for good to them that love god", ["Romans 8:28"]],
  ["be still and know that i am god", ["Psalms 46:10"]],
  ["no weapon that is formed against thee shall prosper", ["Isaiah 54:17"]],
  ["jesus wept", ["John 11:35"]],
  ["charity suffereth long and is kind charity envieth not", ["1 Corinthians 13:4"]],
  ["the effectual fervent prayer of a righteous man availeth much", ["James 5:16"]],
]
// Fragments of long verses: the case whole-verse indexing gets wrong.
const fragments: [string, string[]][] = [
  ["that's why the bible says eyes have not seen ears have not heard", ["1 Corinthians 2:9", "Isaiah 64:4"]],
  ["he was wounded for our transgressions he was bruised for our iniquities", ["Isaiah 53:5"]],
  ["and the peace of god which passeth all understanding", ["Philippians 4:7"]],
  ["weeping may endure for a night but joy cometh in the morning", ["Psalms 30:5"]],
  ["i know the plans i have for you declares the lord plans to prosper you", ["Jeremiah 29:11"]],
  ["your word is a lamp for my feet a light on my path", ["Psalms 119:105"]],
  ["by his stripes we are healed", ["Isaiah 53:5"]],
  ["train up a child in the way he should go", ["Proverbs 22:6"]],
  ["my grace is sufficient for thee for my strength is made perfect in weakness", ["2 Corinthians 12:9"]],
  ["being confident of this very thing that he which hath begun a good work in you", ["Philippians 1:6"]],
  // NIV wording, which is what many preachers read from
  ["for i know the plans i have for you plans to prosper you and not to harm you", ["Jeremiah 29:11"]],
  ["but those who hope in the lord will renew their strength they will soar on wings like eagles", ["Isaiah 40:31"]],
  ["and the peace of god which transcends all understanding will guard your hearts", ["Philippians 4:7"]],
  ["he was pierced for our transgressions he was crushed for our iniquities", ["Isaiah 53:5"]],
  ["therefore there is now no condemnation for those who are in christ jesus", ["Romans 8:1"]],
  ["do not be anxious about anything but in every situation by prayer and petition", ["Philippians 4:6"]],
  // fragments of genuinely long NIV verses, where NIV clause windows should earn their keep
  ["against the powers of this dark world and against the spiritual forces of evil", ["Ephesians 6:12"]],
  ["neither height nor depth nor anything else in all creation", ["Romans 8:39"]],
  ["if my people who are called by my name will humble themselves and pray", ["2 Chronicles 7:14"]],
  ["but the fruit of the spirit is love joy peace forbearance kindness", ["Galatians 5:22"]],
  ["even though i walk through the darkest valley i will fear no evil", ["Psalms 23:4"]],
  ["and do not conform to the pattern of this world but be transformed", ["Romans 12:2"]],
]

const talk = [
  "good morning church it is so good to see everybody here today",
  "turn to your neighbor and tell them you are blessed",
  "i was talking to my wife the other day about this very thing",
  "the ushers will now come forward to receive the offering",
  "can somebody say amen in this place",
  "when i was a young man growing up in the village we had nothing",
  "god is good all the time and all the time god is good",
  "we need to pray for our nation and for our leaders",
  "i want you to understand what paul was dealing with in this church",
  "if you are visiting with us for the first time please stand",
  "the devil is a liar and he wants to steal your joy",
  "somebody is going to get their breakthrough this morning",
  "let us bow our heads and close our eyes",
  "you cannot love god and hate your brother it does not work that way",
  "next sunday we will continue with part three of this series",
  "faith is not a feeling faith is a decision you make every day",
]

async function match(text: string) {
  const { quote, hadLeadIn } = stripLeadIn(text)
  const output = await extractor(meta.queryPrefix + quote, { pooling: "mean", normalize: true })
  return pickQuote(output.data as Float32Array, indexes, hadLeadIn)
}

let found = 0
let wrong = 0
console.log("QUOTES (want the right verse)")
for (const [text, expected] of quotes as [string, string[]][]) {
  const m = await match(text)
  const verdict = !m ? "silent" : expected.includes(m.reference) ? "ok    " : "WRONG "
  if (m && expected.includes(m.reference)) found++
  if (m && !expected.includes(m.reference)) wrong++
  console.log(`  ${verdict} ${m ? `${m.score.toFixed(2)} +${m.margin.toFixed(2)}${m.viaPhrase ? " P" : "  "} ${m.reference}` : ""}`.padEnd(46), text.slice(0, 52))
}
console.log("FRAGMENTS of long verses (want the right verse)")
let fragFound = 0
let fragWrong = 0
for (const [text, expected] of fragments) {
  const m = await match(text)
  if (m && expected.includes(m.reference)) fragFound++
  if (m && !expected.includes(m.reference)) fragWrong++
  const verdict = !m ? "silent" : expected.includes(m.reference) ? "ok    " : "WRONG "
  console.log(`  ${verdict} ${m ? `${m.score.toFixed(2)} +${m.margin.toFixed(2)}${m.viaPhrase ? " P" : "  "} ${m.reference}` : ""}`.padEnd(46), text.slice(0, 52))
}

let spoke = 0
console.log("TALK (want silence)")
for (const text of talk) {
  const m = await match(text)
  if (m) spoke++
  console.log(`  ${m ? `SPOKE  ${m.score.toFixed(2)} +${m.margin.toFixed(2)}${m.viaPhrase ? " P" : ""} ${m.reference}` : "silent"}`.padEnd(46), text.slice(0, 52))
}
console.log(
  `\nquotes ${found}/${quotes.length} (wrong ${wrong}), fragments ${fragFound}/${fragments.length} (wrong ${fragWrong}), talk triggered ${spoke}/${talk.length}`,
)
