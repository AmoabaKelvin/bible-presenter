# Songs / Lyrics — MVP Spec

Goal: an operator pastes lyrics copied from the web, and within seconds has a
projectable song. Paste is the primary path. No CCLI/copyright handling in the
MVP. Stored in IndexedDB.

## Core decision: blank lines are slide breaks

People paste full lyrics where the chorus is already written out in order, and
they think in terms of "stanzas separated by blank lines." So:

- A song is an **ordered list of lyric slides**, one slide per blank-line block.
- The pasted order *is* the performance order — no separate arrangement, no
  section reuse/dedup. That's the right simplification for a paste-first tool;
  sections + arrangement can come later for authoring-heavy users.

This makes a song structurally close to a notes deck (an ordered set of slide
cards), so we reuse those patterns — the slide body is plain lyric text instead
of a rich-text editor.

## Data model

```ts
interface SongSlide {
  id: string
  label: string      // operator-only hint ("Verse 1", "Chorus"); never projected
  lines: string[]    // lyric lines for this slide
}

interface Song {
  id: string
  title: string
  slides: SongSlide[]
  createdAt: number
  updatedAt: number
}
```

`SlideKind` gains `"song"`. A song slide projects via the existing
`SelectedVerse` ({ kind: "song", text: lines joined, reference: song title }).

## The paste parser (the most important piece)

`lib/song-parse.ts` → `parseSongLyrics(raw: string): SongSlide[]`

1. Normalize line endings (`\r\n?` → `\n`), trim trailing whitespace per line.
2. Split into blocks on one-or-more blank lines: `text.split(/\n[ \t]*\n+/)`.
3. For each block: trim leading/trailing empty lines; skip if empty.
4. Detect an optional section header on the first line:
   `^\s*[\[(]?\s*(verse|chorus|pre[- ]?chorus|bridge|tag|intro|outro|ending|refrain|interlude|vamp)\s*(\d+)?\s*[\])\:]?\s*$` (case-insensitive).
   - If matched → `label` = title-cased header; strip that line from `lines`.
   - Else → leave for auto-labeling.
5. Auto-label unlabeled blocks sequentially ("Verse 1", "Verse 2", …). Labels are
   operator hints only; lyrics project correctly regardless of label accuracy,
   and the operator can rename.
6. A header-only block (no lyric lines) is skipped.

No duplicate collapsing, no auto-splitting of long blocks: a block is exactly
one slide (honoring "blank lines = breaks"). A pathological no-blank-lines paste
becomes one big slide; the existing slide text-fit shrinks it, and the operator
adds blank lines. (Optional later: warn / offer auto-split for very long blocks.)

Title: the paste dialog has a Title field. If left empty, default to the first
non-empty line of the lyrics, else "Untitled song".

## Projection

`lib/song-slides.ts`:
- `songToVerses(song): SelectedVerse[]` — map each slide in order to a
  `SelectedVerse` (kind "song", `text` = `lines.join("\n")`, `reference` =
  `song.title` for operator-facing queue/history; not shown on screen).
- Per-slide preview/project, and "Add song to queue" (all slides in order) —
  identical pattern to the notes deck. The operator presents by stepping the
  queue (existing next/prev). No new stepping code.

`components/slide-stage.tsx`: add a `song` branch — centered lyric lines, line
breaks preserved, larger weight, **no reference line** (clean lyrics). Reuses
the existing scale + text-fit.

## Persistence (IndexedDB)

`lib/song-store.ts` — an IndexedDB store mirroring `lib/bible-cache.ts`'s helper
(its own DB or a "songs" store), keyed by song id:
- `getAllSongs()`, `putSong(song)`, `deleteSong(id)`.

`hooks/use-operator-songs.ts` loads all songs on mount into state, filters
in-memory for search, and writes each change back to IDB (debounced). Hundreds
of songs of small text load and filter fine client-side.

## UI

New left-rail mode **"Songs"** (distinct icon from the audio "Music" mode).

`components/operator/songs-pane.tsx` — mirrors the notes pane:
- Left: `song-list.tsx` — searchable list (title + lyrics), New / Paste, delete.
- Main: selected song —
  - Title field.
  - **"Paste lyrics"** is the prominent action → `paste-song-dialog.tsx`
    (Title input + large textarea) → `parseSongLyrics` → creates the song.
  - Slides as editable cards (`song-slide-card.tsx`): label + a plain
    multi-line textarea of lyric lines, with per-card preview / go-live / queue,
    move up/down, delete, active-card highlight, add-slide animation — the same
    affordances as the note cards.
  - Footer: "Add song to queue".

## Files

New:
- `lib/song-parse.ts` — `parseSongLyrics`.
- `lib/song-slides.ts` — `songToVerses`, `emptySongSlide`, `newId`.
- `lib/song-store.ts` — IndexedDB CRUD.
- `hooks/use-operator-songs.ts` — library + active song + edits + paste import.
- `components/operator/songs-pane.tsx`, `song-list.tsx`, `song-slide-card.tsx`,
  `paste-song-dialog.tsx`.

Modify:
- `components/operator/types.ts` — `Mode += "songs"`, `SlideKind += "song"`.
- `components/operator/left-rail.tsx` — Songs mode entry + icon.
- `components/slide-stage.tsx` — `song` rendering branch.
- `app/page.tsx` — wire `useOperatorSongs` + `SongsPane` + mode.

## Reuse vs new

Reuse: preview → live → queue, queue stepping, slide-stage scale/text-fit, the
notes card-editor UX patterns, the left-rail mode system. We deliberately build
song-specific components mirroring notes (plain textarea vs rich text) rather
than prematurely abstracting a shared "deck editor".

## Out of scope (MVP)

CCLI/copyright, sections + arrangement with reuse/repeat, dedicated section-aware
presenter, file-format imports (OpenLyrics / ProPresenter / ChordPro), CCLI
reporting, songs in a saved service plan. Captured in `roadmap.md` for later.
