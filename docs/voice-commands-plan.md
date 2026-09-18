# Voice commands (scripture) — plan

Scope: scripture only. Say a reference → it opens (live or preview, per setting). "Next verse" / "previous verse" step from the current verse. Slides, songs, queue: later.

## How others do it

Every product in this space is the same pipeline: **streaming speech-to-text → text parser → action**. The "AI" is the STT; the scripture part is regex.

- **PewBeam**: Deepgram Nova-3 streaming (online), MLX-Whisper large-v3-turbo (offline, paid). Layer 1 regex on spoken refs (<5ms). Layer 2 embedding search over ~31k verses for quotes/paraphrases (200–400ms). ~2s end to end. Voice next/prev "still being integrated" per their docs.
- **Rhema** (MIT, Tauri+React, github.com/openbezal/rhema): Whisper or Deepgram; Aho-Corasick + Fuse.js for book names; "reading mode" locks book/chapter for navigation. Best reference to read.
- **PrayerKey Live**: plain Web Speech API in Chrome. Proves the cheap stack works.
- **BibleCue**: Google/Deepgram/Whisper, fuzzy parsing tuned for accented English.

We already own PewBeam's layer 2: `lib/semantic-search.ts` (bge-small over BSB). Quote detection is a later phase, not new tech.

## STT choice

**Decided: on-device model, no cloud. Native helper when available (fast), in-browser fallback otherwise.** The preacher is mic'd and arrives as a PA/mixer feed, so the app must pick an input device; that alone rules out Chrome's Web Speech API (system default mic only). It also only works in real Google Chrome (Dia/Arc/Brave report a bogus `network` error) and gave nothing even there. Removed.

Pipeline (`lib/voice-local-engine.ts`): `getUserMedia({deviceId})` → AudioWorklet → `lib/voice-segmenter.ts` (energy-gated utterances, partial every 700 ms, final on a 600 ms pause, resampled to 16 kHz) → `lib/voice-worker.ts` (model on WebGPU, WASM fallback) → same parser. One transcription in flight; stale partials are dropped.

### Benchmark

`scripts/stt-eval/`: `make-clips.ts` builds 128 clips (32 phrases × 2 of 5 TTS accents × clean / simulated-PA). `score.ts` runs transcripts through the real parser and reports **parser hit rate** and **wrong actions** (did something, but the wrong thing — worse than a miss). `run-tfjs.mjs` transcribes with any transformers.js model in Node (accuracy carries to the browser, CPU speed does not). Synthetic voices flatter every model; real recordings can be dropped into `clips/` + `manifest.json`.

Results 2026-09-18 (after parser fixes below):

| Model (via) | hit all | clean | PA | wrong actions | Notes |
|---|---|---|---|---|---|
| Whisper small.en q8 (transformers.js) | 94% | 97% | 89% | 1 | 1.1 s/clip on CPU; WebGPU speed unmeasured |
| Whisper base.en q8 (transformers.js) | 88% | 95% | 80% | 2 | |
| Moonshine base q8 (transformers.js) | 80% | 89% | 70% | 3 | First model wired in; owner found it unusable live |
| Parakeet **CTC** 0.6b q4 (transformers.js 4.2) | 63% | 73% | 52% | 5 | JS port is broken: stuttered letters ("johhn", "matththew") and empty outputs. Not the model's real quality |
| Parakeet **TDT** 0.6b v2 (parakeet.js, WebGPU) — **wired in now** | 11/11 on the hard PA clips played through the live pipeline (not yet the full 128) | | | 0 | Got Habakkuk, Ecclesiastes, 1 Thessalonians, Zephaniah, Psalm 119:105 right where every other model failed |

Parakeet TDT in the browser, measured on the M1 Pro (16 GB):
- fp16 encoder (1.2 GB single file) cannot load: `std::bad_alloc` copying into the 32-bit WASM heap. fp32 with external data (2.4 GB download, IndexedDB) loads. Untried: re-export fp16 *with external data* and self-host it; should halve memory and speed up the encoder.
- The WebGPU encoder is the entire cost (decoder ~30 ms, mel ~5 ms): ~0.8 s for 1.5 s of audio, ~1.3 s for 3 s, ~2 s for 5 s. A reference landed on screen ~1.6 s after it was spoken. PewBeam claims ~2 s.
- WebGPU recompiles per input shape (first sight of a length: 3.5 s). Clips are therefore zero-padded to whole seconds and those shapes compiled at load ("Warming up…").
- Every number above was taken with the machine ~28 GB into swap and CPU benchmarks running beside it, so they are pessimistic and noisy; under that pressure the encoder degraded to 3-9 s. 2.4 GB of weights on a busy 16 GB Mac is the real risk. Re-measure on a quiet machine before judging.
- Parakeet **CTC** through transformers.js is a dead end (evaluator confirmed): the JS pipeline skips CTC collapse-repeats (hence "johhn"), and 12% of clips decode to nothing at every precision. With the decoder patched it still only reaches 73%.

What the benchmark taught the parser (each was a measurable jump): Whisper writes chapter-verse as "John 1-1"; decoders stutter letters; rare book names come out one or two letters off ("habakkup", "naham") or clipped ("ecclesias") → fuzzy book match, only accepted with a full valid chapter+verse after it; and when a book is garbled, the leftover "…two verse four" must NOT fire as a bare verse jump.

Native companion (FluidAudio/CoreML, sherpa-onnx server) stays the fallback if browser inference can't carry Parakeet on the church Mac.

## FlowCast Voice helper (macOS) — the fast path

`voice-helper/`: a Swift menu-bar app (no Dock icon) that runs Parakeet TDT 0.6b v2 on the Neural Engine through FluidAudio, the engine inside FluidVoice, and serves it on `ws://127.0.0.1:47821`. The browser still owns the microphone, input picker and utterance cutting; the helper only turns clips into text. `lib/voice-local-engine.ts` tries the helper first and falls back to the in-browser model (Windows, or helper not running). The status strip says which one is in use.

Build/run: `cd voice-helper && swift build -c release && .build/release/FlowCastVoice`. First run downloads the CoreML models (~600 MB + ~100 MB dictionary model) to FluidAudio's cache.

Measured on the M1 Pro, all 128 clips over the real WebSocket (`bun scripts/stt-eval/run-helper.ts out.json [--vocab]`):

| | hit all | clean | PA | wrong actions | per clip |
|---|---|---|---|---|---|
| Helper, no dictionary | 95% | 95% | 94% | 3 | 107 ms median |
| Helper + dictionary (+ filler-word parser fix) | **98%** | 98% | 97% | 1 | 281 ms median |
| In-browser Parakeet (same model, WebGPU) | same transcripts | | | | 1–9 s |

Live through the whole pipeline (fake mic → segmenter → helper → parser): ready in 0.3 s (in-browser: 22 s + warm-up); a reference fires ~0.1 s after it is spoken without the dictionary, ~0.5–0.9 s with it (each transcription takes longer, so fewer partials fit). Remaining misses are genuinely ambiguous speech: "John one one" heard as "John 11", and one accent's "next verse" heard as "next was".

**Custom dictionary** = FluidAudio vocabulary boosting: a second small CTC model (Parakeet 110M) scores the dictionary words against the audio and corrects the transcript where the evidence is stronger ("Natam" → Nahum, "Phileme" → Philemon). No retraining. The web app sends the words (`lib/voice-vocabulary.ts`: long book names + "Psalm", "chapter", "verse") when it connects, so a user-editable dictionary later is just more words in that message. Short names (John, Mark, Job) are deliberately left out: boosting them would turn ordinary words into book names.

Security: loopback only, and the WebSocket handshake rejects any Origin other than localhost / bible.kelvinamoaba.com.

Not done yet: launch at login, Windows equivalent, fine-tuned weights (would be a model-file swap inside the helper).

### One app instead of two — spiked, works

A plain **Tauri v2** shell bundles the helper as a sidecar, so the user installs one thing. Built and ran it (2026-09-18): `FlowCast.app`, **28 MB**, containing `Contents/MacOS/flowcast-spike` (the shell) and `Contents/MacOS/FlowCastVoice` (the helper). Launching the app spawned the helper, which bound port 47821, and the operator console rendered as a native Mac window.

**The web app needs no changes** — the shell points at a URL, so the site stays deployed on Cloudflare exactly as it is. The whole shell is five small files:

- `Cargo.toml` (deps: `tauri`, `tauri-plugin-shell`), `build.rs`
- `tauri.conf.json` — window `url`, `bundle.externalBin: ["binaries/FlowCastVoice"]`, icon list
- `capabilities/default.json` — `shell:allow-spawn` for the sidecar
- `src/main.rs` — ~15 lines: init the shell plugin, `app.shell().sidecar("FlowCastVoice").spawn()`
- `Info.plist` (`NSMicrophoneUsageDescription`) + `entitlements.plist` (`com.apple.security.device.audio-input`)

Friction hit on the way: the sidecar binary must be named with the target triple (`FlowCastVoice-aarch64-apple-darwin`); Tauri only builds universal binaries for its own Rust, so an Intel build means `swift build --arch arm64 --arch x86_64` by hand; and the default icon path crashed the build until `cargo tauri icon` generated the proper set.

Pake was rejected for this: it is a Tauri wrapper but exposes no sidecar support, so it cannot bundle the helper.

**Blocker, confirmed by trying it: the projector window does not open.** `window.open("/slideshow")` is not honoured in the Tauri webview, so there is no output display — which is the whole point of the app. Fixing it means creating the second window through Tauri (`WebviewWindow`) and replacing the `localStorage` + `storage`-event transport, since two Tauri webviews are not guaranteed to fire that event to each other. Reckon ~30 lines in `use-slideshow-output.ts` plus the slideshow page, behind a "running inside Tauri" check so the browser keeps working as it does. Real work, but not a rewrite. Also unverified: the microphone prompt actually granting, and whether WebGPU exists in WKWebView (only matters for the in-browser fallback, which the sidecar makes redundant on a Mac).

Not done: code signing and notarization, which need an Apple Developer account ($99/yr). Unsigned, the app opens via right-click → Open.

Parked until the browser version has run real services. The helper stays a separate install in the meantime.

## Quote detection ("the Bible says eyes have not seen…") — built

No reference spoken, just the words. `lib/voice-quote.ts` runs on every final utterance that contained no reference or command: strip the lead-in ("that's why the Bible says", "it is written", "Jesus said"), embed with the same local bge-small model as Cmd+K, search the verse indexes, and speak up only when one verse clearly wins. Hits go through the normal reference path (so they respect Auto-live and show in the operator's translation) and read `→ 1 Corinthians 2:9 (quote)`.

**Indexes** (`public/bibles/embeddings/`, ~80 MB, fetched on the first quote):

| | rows | size | why |
|---|---|---|---|
| `bsb.bin` | 31k verses | 12 MB | already loaded for Cmd+K |
| `kjv.bin` | 31k verses | 12 MB | preachers quote the KJV, and its vocabulary ("charity", "effectual fervent") has no modern neighbour |
| `niv.bin` | 31k verses | 12 MB | the other translation preached from here |
| `kjv.phrases.bin` | 121k clause windows | 46 MB | see below |

**Why clause windows.** A fragment of a long verse is drowned out by the rest of it: "eyes have not seen, ears have not heard" ranked 1 Corinthians 2:9 *third*, behind Mark 8:18. Indexing one- and two-clause windows of verses ≥ 25 words fixes it — that fragment matches the window "Eye hath not seen, nor ear heard" at 0.87. Single-clause windows alone are half the size but miss exactly this case, so windows span up to two clauses. KJV only: measured against NIV-worded fragments of long verses, an NIV phrase index changed **no** verdict and wasn't worth another 31 MB.

**How it stays fast.** Two stages: score whole verses (93k rows), keep the top 48 per translation, then score only those verses' clause windows. The 121k-row phrase index never sits on the critical path. Measured in the browser: **~130 ms** per sentence end to end (embed + search), so a quote lands ~1.0 s after the speaker stops — the 0.6 s silence gap and the recognizer account for the rest.

**How it decides.** Two independent verdicts — the whole verse matched, or one of its clauses did — and the first to pass wins. Kept separate because scoring clauses lifts rivals as much as the answer, which erased the margin on short verses like "be still and know that I am God". Each verdict needs a score *and* a clear lead over the best genuinely different passage (a gospel parallel or the same verse in another translation is not a rival). Whole verse: ≥ 0.76 (0.70 after a lead-in), lead ≥ 0.06. Clause: ≥ 0.82, lead ≥ 0.06.

**Check**: `bun scripts/eval-quote-threshold.ts` → quotes 20/20, fragments 21/22, **0 wrong verses**, 1/16 of the ordinary-sermon lines triggered (and that one, "you cannot love God and hate your brother" → 1 John 4:20, is a correct paraphrase). Thresholds are fitted to that sample — 36 quotes and 16 sermon lines, all written by hand — so they are a starting point, not a calibration. Real sermon audio is the test that matters.

Files over Cloudflare's 25 MiB asset cap ship as `.part0`, `.part1` and are stitched at load, the same trick the ONNX model uses.

**Offline.** The service worker caches `/bibles/embeddings/` cache-first, the same treatment the 22 MB Webster's dictionary already gets: too big to precache, so they land in the cache on first use and stay. Switching the mic on pulls all of them (`warmQuoteIndexes`), so one online session is enough to arm a service that then runs with no network. They are not content-hashed, so a rebuilt index needs the `VERSION` bump in `public/sw.js`.

Verified by building for production, loading once, killing the web server, and reloading: the app, a spoken reference, and a quoted fragment all still worked. Two bugs that only appear offline came out of that test — a missing-file `fetch` **rejects** offline instead of returning 404, which silently dropped the whole KJV and NIV indexes and left quote detection quietly worse; and an `AudioContext` created outside a click starts suspended, which would have made the mic look live while hearing nothing.

Rejected: hosted embeddings (OpenAI). Only the query side would need the network — the verse index ships as a file either way — but that is a network call per sentence and the end of offline use. On the one fragment tested, `text-embedding-3-large` ranked the right verse first but narrowly; `3-small` and Qwen3-8B got it wrong. Clause windows solved it locally instead.

## "Go back"

`{ type: "back" }`: "go back", "take me back", "take us back to where we were", "previous scripture". `app/page.tsx` keeps a stack of where voice jumped *from* (references and quotes push; stepping doesn't), so repeated "go back" unwinds. "go back to John 3:16" is a reference, not a back.

## NIV

Added as a bundled translation (`public/bibles/niv.json`, `scripts/fetch-bible.mjs NIV`) so it reads offline like the others, and indexed for quote detection. `scripts/fetch-kjv.mjs` and `fetch-bsb.mjs` were identical apart from a comment; they are now one `fetch-bible.mjs <CODE>`.

## Commands, as tuned against real use

Owner reported next/previous verse were the weak spot. Now: a command is a short utterance (≤ 8 words) that *ends* with the instruction ("okay, can we have the next verse please"), "verse" is accepted as recognizers mangle it in two-word clips — from real use: phase, base, best, face, vase, vest, voice, worse, worst, first, was, vers, versus, birth, burst. Because "next phase" is also ordinary English, a sound-alike only counts when the command is the whole utterance; "next verse" proper can sit at the end of a longer sentence. Between two numbers a sound-alike can only mean verse ("John 3 phase 16"), "in/of/from the next verse" is a preacher describing and is ignored, and commands fire from partials (two in agreement) instead of waiting ~0.6 s for the pause.

## Design

Three pieces, all small.

### 1. `lib/voice-parse.ts` — transcript → intent (pure, the real work)

```ts
type VoiceIntent =
  | { type: "reference"; book: BibleBook; chapter: number; verse?: number }
  | { type: "step"; delta: 1 | -1 }
  | { type: "verse"; verse: number }        // "verse 5" → current book/chapter
  | { type: "chapter"; delta: 1 | -1 }

parseVoiceTranscript(text: string): VoiceIntent | null
```

Token-based, not a wrapper around `parseFullScriptureReference`: that one wants a whole string shaped `Book C:V` and clamps, while speech needs a reference found mid-sentence, number words, and strict validation.

Normalizer steps:
1. lowercase, strip punctuation
2. number words → digits ("one hundred twenty one" → 121, "twenty-third" → 23)
3. ordinals on books: "first/second/third john" → "1/2/3 john"
4. "chapter"/"verse" are kept as structure, not dropped: numbers before "verse" are the chapter, after it the verse. That is what separates "psalm one twenty one verse four" (121:4) from "john one twenty one" (1:21)
5. without markers, try chapter/verse splits against real counts ("john 3 16", "psalm 1 21" → 121)
6. spoken-alias table for what STT actually emits: "psalm"→Psalms, "revelations"→Revelation, "song of songs"→Song of Solomon, "acts of the apostles", plus mishearings collected from real use ("roman's", "job"/"jobe", "mark"/"marc")
7. scan for a reference *anywhere* in the text, not only a full-string match — a sermon sentence is "let's turn to John chapter 3 verse 16 tonight"

Two fixes to existing behavior this needs:
- **Reject out-of-range, don't clamp.** `parseFullScriptureReference` silently turns "Psalm 200" into Psalm 150. For voice that projects the wrong verse. Add a strict check using `book.chapters` (`lib/bible-data.ts`) in the voice path; leave the typeahead's clamping alone.
- **Ambiguous digit runs.** STT may emit "john 316" or "psalm 1214". Try splits against real chapter/verse counts; accept only if exactly one split is valid ("psalm 1214": 121:4 exists, 12:14 doesn't since Psalm 12 has 8 verses → 121:4), otherwise ignore.

Check: `bun scripts/test-voice-parse.ts` — plain asserts, no framework (repo has none). Add every real-world mishearing there first, then teach the parser.

### 2. `hooks/use-voice-commands.ts` — mic → transcript

Wraps `webkitSpeechRecognition`. `continuous = true`, `interimResults = true`, `lang = "en-US"`. Restart in `onend` while enabled (backoff, stop on `not-allowed`). Chrome's on-device mode + `phrases` biasing is deliberately not built: the local-model route above supersedes it.

Firing rules:
- **References**: fire on interim once the parse is complete (has verse) and unchanged for ~400ms; else on final. Gets near-instant feel without acting on half a sentence ("John 3" → "John 3 16").
- **Navigation ("next verse")**: final results only.
- Dedupe: never fire the same intent twice from one utterance.

Exposes `{ supported, listening, heard, lastAction, error, toggle }`.

### 3. Wiring in `app/page.tsx` — intent → existing actions

| Intent | Auto-project ON | Auto-project OFF |
|---|---|---|
| reference | `handleJumpProject(book, ch, v)` (`use-bible-navigation.ts:129`) | `handleJumpSelect(book, ch, v)` (`:122`) |
| next/previous verse | step + project | `stepSelectedVerse(±1)` (`use-bible-verse-actions.ts:75`) |
| "verse N" | same as reference, current book/chapter | same |
| next/previous chapter | `goToNextChapter` / `goToPreviousChapter` | same |

Reference with no verse ("Psalm 23") → verse 1.

Gap to fill: `stepSelectedVerse` stops dead at chapter ends and only touches preview. Add rollover (John 1:51 → "next" → John 2:1) using `getNextChapterRef`/`getPrevChapterRef` (`lib/bible-data.ts:316,324`), and a project-after-step path for auto mode. Fix it in `stepSelectedVerse` itself so the ↓/↑ keys get rollover too.

"Next verse" steps from the reader's selected verse. With auto-live on, voice keeps selection and live in lockstep, so that is what the room sees; if the operator clicks elsewhere in between, it steps from their click.

### Settings + UI

- `usePersistedState("voice:autoProject", false)` in `app/page.tsx`. Default is preview, not live: a misheard verse on the projector mid-sermon is worse than one extra Space press. Listening itself is never persisted; the mic only opens on a click.
- Mic button in the right-rail header (`components/operator/voice-control.tsx`), not the bible toolbar, so it works from Notes/Songs mode too.
- Status strip under it while listening: what was heard → what it did, plus the Auto-live toggle. This is the debugging tool in the room; without it nobody can tell mishearing from misparsing.
- `Esc` already clears live = the undo.

## False triggers

A preacher saying "in the next verse Paul says…" will step the verse. Mitigations, in order of cost:
1. Navigation commands must be the **whole utterance** (short final result matching `^(next|previous) verse$`), not a substring. References can be substrings; commands can't.
2. Default to preview mode.
3. If still noisy: wake word ("presenter, next verse") or push-to-talk key. Not building until it's a real problem.

## Status (2026-09-18)

Speech engine is now the local Parakeet pipeline above (Web Speech removed); verified by playing benchmark clips in as a fake microphone, still never with a live human voice. Phases 1–3 built on branch `voice-commands` and verified in Chrome with a fake recognizer (references from partials, whole-utterance nav, chapter rollover both ways, "verse N", invalid refs ignored, auto-live). **Not yet tried with a real voice.** Fixed along the way: cold jumps to another chapter labelled the slide correctly but showed the previous chapter's text (`use-bible-navigation.ts` now refuses verses that don't belong to the current selection).

## Phases

1. **Parser + asserts.** `lib/voice-parse.ts`, `scripts/test-voice-parse.mjs`. Pure, no mic. Most of the value and most of the bugs live here.
2. **Hook + wiring + mic button + heard-chip.** Web Speech only. Preview mode. Usable end of this phase.
3. **Auto-project setting + chapter rollover + step-from-live.**
4. **Room test** with the real mic/PA. Collect mishearings into the alias table. Decide here whether Deepgram fallback is needed.
5. Later, if wanted: Deepgram via Worker WebSocket; quote detection via existing semantic search; ranges ("John 3 16 to 18"); version switching ("in the Message"); slides/songs commands.

## Open questions

- Who wears the mic: operator at the desk (clean, commands work well) or the preacher via the PA feed (PewBeam's model; noisier, more false triggers, makes wake-word/whole-utterance rules matter more)? Changes phase 4, not phases 1–3.
- OK that default Web Speech sends audio to Google when on-device mode is unavailable?
