// Import songs from an EasyWorship 6/7 library. EasyWorship keeps songs in two
// SQLite files under …\Softouch\Easyworship\Default\v6.1\Databases\Data:
//   Songs.db      → table `song` (rowid, title, author, copyright, …)
//   SongWords.db  → table `word` (song_id, words) — lyrics as RTF
// The RTF is plain paragraphs: section names ("Verse 1", "Chorus") on their own
// line, a blank paragraph between sections — the same shape parseSongLyrics
// already reads, so an imported song is just (title, lyrics text).

export interface EasyWorshipSong {
  title: string
  lyrics: string
}

// Groups whose content is never lyric text.
const SKIPPED_DESTINATIONS = new Set([
  "fonttbl",
  "colortbl",
  "stylesheet",
  "info",
  "pict",
  "header",
  "footer",
])

const SYMBOLS: Record<string, string> = {
  par: "\n",
  line: "\n",
  tab: "\t",
  lquote: "‘",
  rquote: "’",
  ldblquote: "“",
  rdblquote: "”",
  emdash: "—",
  endash: "–",
  bullet: "•",
}

const TOKEN =
  /\\([a-z]+)(-?\d+)? ?|\\'([0-9a-f]{2})|\\([^a-z])|([{}])|[\r\n]+|([^\\{}\r\n]+)/gi

// ponytail: \'hh bytes decode as cp1252 only (EasyWorship 6+ writes non-Latin
// text as \uN escapes). Read \ansicpg/\fcharset if a legacy library needs more.
const cp1252 = new TextDecoder("windows-1252")

export function rtfToText(rtf: string): string {
  let out = ""
  let skip = false
  const stack: boolean[] = []
  let ucSkip = 1 // fallback chars that follow each \uN
  let pending = 0 // fallback chars still to drop

  for (const m of rtf.matchAll(TOKEN)) {
    const [, word, param, hex, symbol, brace, text] = m
    if (brace === "{") {
      stack.push(skip)
    } else if (brace === "}") {
      skip = stack.pop() ?? false
    } else if (word) {
      if (SKIPPED_DESTINATIONS.has(word)) skip = true
      else if (word === "uc") ucSkip = Number(param ?? 1)
      else if (skip) continue
      else if (word === "u") {
        const code = Number(param)
        out += String.fromCodePoint(code < 0 ? code + 65536 : code)
        pending = ucSkip
      } else if (word in SYMBOLS) out += SYMBOLS[word]
    } else if (hex) {
      if (pending > 0) pending -= 1
      else if (!skip) out += cp1252.decode(Uint8Array.of(parseInt(hex, 16)))
    } else if (symbol) {
      if (symbol === "*") skip = true
      else if (skip) continue
      else if (symbol === "~") out += " "
      else if (symbol === "_") out += "-"
      else if ("\\{}".includes(symbol)) out += symbol
    } else if (text) {
      const kept = text.slice(pending)
      pending = Math.max(0, pending - text.length)
      if (!skip) out += kept
    }
  }
  return out
}

export async function readEasyWorshipSongs(
  songsDb: Uint8Array,
  wordsDb: Uint8Array,
): Promise<EasyWorshipSong[]> {
  const { default: initSqlJs } = await import("sql.js")
  const SQL = await initSqlJs(
    typeof window === "undefined" ? undefined : { locateFile: () => "/sqljs/sql-wasm.wasm" },
  )
  const songs = new SQL.Database(songsDb)
  const words = new SQL.Database(wordsDb)
  try {
    const lyricsById = new Map<number, string>()
    for (const [id, rtf] of words.exec("SELECT song_id, words FROM word")[0]?.values ?? []) {
      const source = rtf instanceof Uint8Array ? new TextDecoder().decode(rtf) : String(rtf ?? "")
      lyricsById.set(Number(id), rtfToText(source).trim())
    }
    const result: EasyWorshipSong[] = []
    for (const [id, title] of songs.exec("SELECT rowid, title FROM song ORDER BY title")[0]
      ?.values ?? []) {
      const lyrics = lyricsById.get(Number(id))
      if (lyrics) result.push({ title: String(title ?? "").trim(), lyrics })
    }
    return result
  } finally {
    songs.close()
    words.close()
  }
}

// Pick Songs.db + SongWords.db out of whatever the operator selected.
export async function readEasyWorshipFiles(files: File[]): Promise<EasyWorshipSong[]> {
  const find = (name: string) => files.find((f) => f.name.toLowerCase() === name)
  const songs = find("songs.db")
  const words = find("songwords.db")
  if (!songs || !words) {
    throw new Error("Select both Songs.db and SongWords.db from EasyWorship's Databases\\Data folder.")
  }
  const [a, b] = await Promise.all([songs.arrayBuffer(), words.arrayBuffer()])
  return readEasyWorshipSongs(new Uint8Array(a), new Uint8Array(b))
}
