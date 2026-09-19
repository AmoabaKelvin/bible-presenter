// Self-check for lib/easyworship-import.ts. Usage: bun scripts/test-easyworship-import.ts
//
// The RTF below is the shape EasyWorship 6 really writes (header groups, one
// \par per line, an empty paragraph between sections, \uN? for non-ASCII).

import assert from "node:assert/strict"
import initSqlJs from "sql.js"
import { readEasyWorshipSongs, rtfToText } from "@/lib/easyworship-import"
import { parseSongLyrics } from "@/lib/song-parse"

const P = String.raw`\li0\fi0\ri0\sb0\sl\sa0 \plain\f1\fntnamaut `
const RTF =
  String.raw`{\rtf1\ansi\deff0\deftab254{\fonttbl{\f0\fnil\fcharset1 Arial;}{\f1\fnil\fcharset1 Verdana;}}` +
  String.raw`{\colortbl\red0\green0\blue0;\red255\green0\blue0;}\paperw12240` +
  String.raw`{\*\pnseclvl1\pnucrm\pnstart1\pnhang\pnindent720{\pntxtb}{\pntxta{.}}}` +
  "\r\n" +
  String.raw`{\pard${P}Verse 1\par` + "\r\n" +
  String.raw`${P}Vi pl\u248?jed og vi s\u229?'de\par` + "\r\n" +
  String.raw`${P}caf\'e9 \{grace\}\par` + "\r\n" +
  String.raw`${P}\par` + "\r\n" +
  String.raw`${P}Chorus \par` + "\r\n" +
  String.raw`${P}Alle gode gaver}` + "\r\n}"

const text = rtfToText(RTF)
assert.equal(text, "Verse 1\nVi pløjed og vi så'de\ncafé {grace}\n\nChorus \nAlle gode gaver")

const slides = parseSongLyrics(text)
assert.deepEqual(
  slides.map((s) => [s.label, s.lines]),
  [
    ["Verse 1", ["Vi pløjed og vi så'de", "café {grace}"]],
    ["Chorus", ["Alle gode gaver"]],
  ],
)

const SQL = await initSqlJs()
const songs = new SQL.Database()
songs.run("CREATE TABLE song (rowid integer PRIMARY KEY, title text, author text)")
songs.run("INSERT INTO song VALUES (1, 'With Words', 'A'), (2, 'No Words', 'B')")
const words = new SQL.Database()
words.run("CREATE TABLE word (rowid integer PRIMARY KEY, song_id integer, words rtf)")
words.run("INSERT INTO word VALUES (1, 1, ?)", [RTF])

const imported = await readEasyWorshipSongs(songs.export(), words.export())
assert.deepEqual(imported, [{ title: "With Words", lyrics: text }]) // wordless songs are skipped

console.log("easyworship-import: ok")
