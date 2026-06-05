# FlowCast — Feature Roadmap & Product Notes

Working notes on where the product stands and what's worth building next.
Captured from a product assessment; revisit and reprioritize as we go.

## Positioning

FlowCast today is a strong, differentiated **Bible-presentation** tool with an
offline-first core. The question for each gap below is: does it move us from
"great for Scripture + media" toward "a church can run their whole service on
this"?

## Current strengths (don't lose these)

- **Offline-first** — works without internet (huge for churches with poor wifi).
  A real edge over cloud-only tools.
- **Bible depth** — many versions, offline reading + search, clean version
  switching, chapter reader, jump, command palette.
- **Semantic verse search** — "describe the verse and it finds it." Genuinely
  differentiated; ProPresenter / EasyWorship / Proclaim don't have this. Lead
  with it in any pitch.
- **Operator model** — preview → live, queue/setlist, history, projected output
  window.
- Media (images/video), music (Spotify/YouTube audio), notes, offline
  dictionary with project-to-slide.

## Prioritized gaps

### 1. Song lyrics library (highest leverage)
The heart of worship presentation and the biggest gap. ~70% of a service's
screen time is **song lyrics for congregational singing**. Today "Music" is
audio playback, not lyrics on screen. Until there's a **Songs** mode we're a
"Scripture + media" tool, not a full worship console.
- Data model: songs -> sections (verse/chorus/bridge/tag) -> arrangements
  (section order). One slide per section.
- Library + fast title/lyric search.
- Import: CCLI SongSelect, OpenLyrics, ProPresenter, ChordPro/plain text.
- Reuses the existing preview -> live -> queue plumbing.
- Later: CCLI usage reporting for copyright compliance.

### 2. Pre-service countdown / timers
"Service starts in 5:00", sermon timer, generic countdowns. Near-universal,
small to build, high perceived value.

### 3. Stage / confidence monitor
A second output for the band/speaker: next slide, clock, current section,
speaker notes. We already have an output window; this is a variant of it.

### 4. Custom & announcement slides + import
Free-text / title / bulleted slides, plus PowerPoint / PDF / Keynote import.
Churches always have announcements and sermon-point slides. (Related to the
"notes as slides" work — see below.)

### 5. Saveable service plan / order of service
Turn the queue into a named, reorderable plan (songs + scripture +
announcements) that can be saved and reloaded each week. Later: Planning Center
integration.

### 6. Livestream features
Lower-thirds, alpha/NDI output for OBS, virtual camera. Increasingly expected by
churches that stream.

### 7. Templates / themes per slide type
Reusable looks beyond the current global presentation settings; per-slide-type
styling (scripture vs song vs announcement).

### 8. Multiple outputs / screens
Different content to different screens (lobby vs main vs stream).

### 9. Remote control
Phone/tablet as a remote to advance slides (operator or speaker).

### 10. Bible niceties
Side-by-side parallel translations, red-letter words, auto-splitting long verse
ranges across multiple slides.

## Lower priority / later
- CCLI reporting, MIDI / control-surface support, cloud library sync across
  machines, on-screen alerts/messages (nursery, etc.).

## Known technical follow-ups
- **Self-host the embedding model** for the semantic search (currently loads
  from the HuggingFace CDN on first use). Needed for fully-offline semantic
  search: host the model file in `public/` and add it + `/bibles/embeddings/*`
  to the service worker (`public/sw.js`). See `memory/semantic-search.md`.

## In discussion now
- **Notes as slides** — let notes become presentable, slide-shaped content
  rather than a single free-form personal document. (Design TBD — see chat.)
