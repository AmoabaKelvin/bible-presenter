"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  type BibleBook,
  getBookId,
  getApiTranslationId,
  getPrevChapterRef,
  getNextChapterRef,
  BIBLE_API_BASE,
} from "@/lib/bible-data"
import type { FontSize, SelectedVerse } from "@/components/slide-stage"
import {
  parseReference,
  stripEm,
  type ScriptureSearchResult,
} from "@/lib/scripture-search"
import { LeftRail } from "@/components/operator/left-rail"
import { CommandPalette } from "@/components/operator/command-palette"
import { BiblePane } from "@/components/operator/bible-pane"
import { NotesPane } from "@/components/operator/notes-pane"
import { MediaPane } from "@/components/operator/media-pane"
import { RightRail } from "@/components/operator/right-rail"
import type { ChapterVerse } from "@/components/operator/chapter-reader"
import type { HistoryItem, MediaItem, Mode, SavedNote, VerseData } from "@/components/operator/types"
import {
  DEFAULT_MUSIC_STATE,
  MUSIC_COMMAND_KEY,
  MUSIC_PROVIDER_KEY,
  MUSIC_STATE_KEY,
  MUSIC_URL_KEY,
  MUSIC_VOLUME_KEY,
  SLIDESHOW_HEARTBEAT_KEY,
  SLIDESHOW_HEARTBEAT_STALE_MS,
  type MusicCommand,
  type MusicCommandInput,
  type MusicState,
  makeCommandId,
} from "@/lib/youtube-music"
import {
  getSpotifyStatus,
  makeSpotifyLoadCommandFromRef,
  type SpotifyAuthStatus,
} from "@/lib/spotify-music"
import {
  getYouTubeStatus,
  type YouTubeAuthStatus,
  type YouTubePlaylistSummary,
  type YouTubePlaylistTrack,
} from "@/lib/youtube-account"
import {
  storeImage,
  resolveImageUrl,
  resolveBackgroundMedia,
  removeImage,
  type BackgroundMediaKind,
} from "@/lib/image-store"
import { getCachedChapter, putCachedChapter, getVersionMeta } from "@/lib/bible-cache"
import { hydrateTranslation } from "@/lib/offline-download"

const HISTORY_KEY = "biblePresenterHistory"
const VERSION_KEY = "bibleVersion"
const BG_COLOR_KEY = "biblePresenterBackgroundColor"
const BG_IMAGE_KEY = "biblePresenterBackgroundImage"
const BG_KIND_KEY = "biblePresenterBackgroundKind"
const MEDIA_KEY = "biblePresenterMedia"
const QUEUE_KEY = "biblePresenterQueue"
const QUEUE_CURSOR_KEY = "biblePresenterQueueCursor"
const NOTES_KEY = "biblePresenterSavedNotes"

export default function OperatorPage() {
  // Mode + selection
  const [mode, setMode] = useState<Mode>("bible")
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null)
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null)
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null)
  const [rangeStartVerse, setRangeStartVerse] = useState<number | null>(null)
  const [rangeEndVerse, setRangeEndVerse] = useState<number | null>(null)

  // Chapter cache
  const [chapterVerses, setChapterVerses] = useState<ChapterVerse[]>([])
  const [chapterLoading, setChapterLoading] = useState(false)
  const [chapterError, setChapterError] = useState<string | null>(null)
  const [pendingVerseSelection, setPendingVerseSelection] = useState<number | null>(null)
  // Set by the jump-to-passage typeahead. Builds + projects the verse to live
  // as soon as chapterVerses for the target reference populates.
  const [pendingProjectVerse, setPendingProjectVerse] = useState<
    { book: BibleBook; chapter: number; verse: number } | null
  >(null)

  // Presentation
  const [previewVerses, setPreviewVerses] = useState<SelectedVerse[]>([])
  const [liveVerses, setLiveVerses] = useState<SelectedVerse[]>([])
  // Media slides carry both the id (for the cross-tab payload / persistence)
  // and a local object URL (for this tab's preview/live rendering).
  const [previewMedia, setPreviewMedia] = useState<{ id: string; url: string } | null>(null)
  const [liveMedia, setLiveMedia] = useState<{ id: string; url: string } | null>(null)
  const [queue, setQueue] = useState<SelectedVerse[]>([])
  const [queueCursor, setQueueCursor] = useState(-1)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [media, setMedia] = useState<MediaItem[]>([])

  // Settings
  const [fontSize, setFontSize] = useState<FontSize>("extra-large")
  const [version, setVersion] = useState("KJV")
  const [backgroundColor, setBackgroundColor] = useState("#000000")
  // backgroundImageId is persisted + small; backgroundImageUrl is the
  // resolved object URL used for rendering in this tab.
  const [backgroundImageId, setBackgroundImageId] = useState<string | null>(null)
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null)
  const [backgroundKind, setBackgroundKind] = useState<BackgroundMediaKind | null>(null)
  const [themeLoaded, setThemeLoaded] = useState(false)

  // Notes
  const [noteTitle, setNoteTitle] = useState("")
  const [noteText, setNoteText] = useState("")
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([])
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const activeNoteIdRef = useRef<string | null>(null)
  const savedNotesRef = useRef<SavedNote[]>([])

  // Music
  const [musicUrl, setMusicUrl] = useState<string | null>(null)
  const [musicState, setMusicState] = useState<MusicState>(DEFAULT_MUSIC_STATE)
  const [slideshowOnline, setSlideshowOnline] = useState(false)
  const [spotifyStatus, setSpotifyStatus] = useState<SpotifyAuthStatus>({ connected: false })
  const [youtubeStatus, setYouTubeStatus] = useState<YouTubeAuthStatus>({ connected: false })

  const previewContentRef = useRef<HTMLDivElement>(null)

  // ── Persistence: load ──────────────────────────────────────────────
  useEffect(() => {
    try {
      const h = localStorage.getItem(HISTORY_KEY)
      if (h) setHistory(JSON.parse(h))
      const v = localStorage.getItem(VERSION_KEY)
      if (v) setVersion(v)
      const bg = localStorage.getItem(BG_COLOR_KEY)
      if (bg) setBackgroundColor(bg)
      const bgImg = localStorage.getItem(BG_IMAGE_KEY)
      if (bgImg) {
        setBackgroundImageId(bgImg)
        resolveBackgroundMedia(bgImg).then((m) => {
          if (!m) return
          setBackgroundImageUrl(m.url)
          setBackgroundKind(m.kind)
        })
      }
      const m = localStorage.getItem(MEDIA_KEY)
      if (m) setMedia(JSON.parse(m))
      const sn = localStorage.getItem(NOTES_KEY)
      if (sn) setSavedNotes(JSON.parse(sn))
      const q = localStorage.getItem(QUEUE_KEY)
      if (q) setQueue(JSON.parse(q))
      const qc = localStorage.getItem(QUEUE_CURSOR_KEY)
      if (qc !== null) setQueueCursor(parseInt(qc, 10))
      const mu = localStorage.getItem(MUSIC_URL_KEY)
      if (mu) setMusicUrl(mu)
      const mv = localStorage.getItem(MUSIC_VOLUME_KEY)
      const initialVolume = mv != null ? Number(mv) : DEFAULT_MUSIC_STATE.volume
      setMusicState((s) => ({ ...s, volume: Number.isFinite(initialVolume) ? initialVolume : s.volume }))
      const cachedState = localStorage.getItem(MUSIC_STATE_KEY)
      if (cachedState) {
        try {
          setMusicState((s) => ({ ...s, ...JSON.parse(cachedState) }))
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore corrupt local state
    }
    setThemeLoaded(true)
  }, [])

  // ── Persistence: save ──────────────────────────────────────────────
  useEffect(() => {
    if (themeLoaded) localStorage.setItem(VERSION_KEY, version)
  }, [version, themeLoaded])
  useEffect(() => {
    if (themeLoaded) localStorage.setItem(BG_COLOR_KEY, backgroundColor)
  }, [backgroundColor, themeLoaded])
  useEffect(() => {
    if (!themeLoaded) return
    try {
      if (backgroundImageId) {
        localStorage.setItem(BG_IMAGE_KEY, backgroundImageId)
        localStorage.setItem(BG_KIND_KEY, backgroundKind ?? "image")
      } else {
        localStorage.removeItem(BG_IMAGE_KEY)
        localStorage.removeItem(BG_KIND_KEY)
      }
    } catch (err) {
      console.error("flowwww: failed to persist background", err)
    }
  }, [backgroundImageId, backgroundKind, themeLoaded])
  useEffect(() => {
    if (themeLoaded) localStorage.setItem(MEDIA_KEY, JSON.stringify(media))
  }, [media, themeLoaded])
  useEffect(() => {
    savedNotesRef.current = savedNotes
    if (themeLoaded) localStorage.setItem(NOTES_KEY, JSON.stringify(savedNotes))
  }, [savedNotes, themeLoaded])
  useEffect(() => {
    if (themeLoaded) localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  }, [queue, themeLoaded])
  useEffect(() => {
    if (themeLoaded) localStorage.setItem(QUEUE_CURSOR_KEY, String(queueCursor))
  }, [queueCursor, themeLoaded])
  useEffect(() => {
    if (!themeLoaded) return
    if (musicUrl) localStorage.setItem(MUSIC_URL_KEY, musicUrl)
    else localStorage.removeItem(MUSIC_URL_KEY)
  }, [musicUrl, themeLoaded])
  useEffect(() => {
    if (themeLoaded) localStorage.setItem(MUSIC_VOLUME_KEY, String(musicState.volume))
  }, [musicState.volume, themeLoaded])

  // Listen for music state pushed by the slideshow tab. We use both the
  // cross-tab `storage` event and a 500ms poll as a belt-and-suspenders
  // — storage events can be missed when the window is backgrounded.
  useEffect(() => {
    const apply = () => {
      const raw = localStorage.getItem(MUSIC_STATE_KEY)
      if (!raw) return
      setMusicState((prev) => {
        if (JSON.stringify(prev) === raw) return prev
        try {
          return JSON.parse(raw) as MusicState
        } catch {
          return prev
        }
      })
    }
    apply()
    const onStorage = (e: StorageEvent) => {
      if (e.key === MUSIC_STATE_KEY) apply()
    }
    window.addEventListener("storage", onStorage)
    const interval = setInterval(apply, 500)
    return () => {
      window.removeEventListener("storage", onStorage)
      clearInterval(interval)
    }
  }, [])

  // Spotify auth status — fetch on mount and after returning from
  // /api/spotify/callback (which appends ?spotify=connected|error).
  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      getSpotifyStatus().then((status) => {
        if (!cancelled) setSpotifyStatus(status)
      }).catch(() => {
        // ignore — status defaults to disconnected
      })
      getYouTubeStatus().then((status) => {
        if (!cancelled) setYouTubeStatus(status)
      }).catch(() => {
        // ignore — status defaults to disconnected
      })
    }
    refresh()
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      if (params.has("spotify") || params.has("youtube")) {
        params.delete("spotify")
        params.delete("youtube")
        const next = window.location.pathname + (params.toString() ? `?${params}` : "")
        window.history.replaceState({}, "", next)
        // status cookie was just set by a provider callback — refresh
        refresh()
      }
    }
    return () => {
      cancelled = true
    }
  }, [])

  // Track whether the slideshow tab is open via its heartbeat
  useEffect(() => {
    const check = () => {
      const raw = localStorage.getItem(SLIDESHOW_HEARTBEAT_KEY)
      const ts = raw ? Number(raw) : 0
      setSlideshowOnline(Number.isFinite(ts) && Date.now() - ts < SLIDESHOW_HEARTBEAT_STALE_MS)
    }
    check()
    const interval = setInterval(check, 1000)
    return () => clearInterval(interval)
  }, [])

  // Send a music command (the slideshow tab handles it)
  const sendMusicCommand = (cmd: MusicCommandInput) => {
    const full = { ...cmd, id: makeCommandId() } as MusicCommand
    localStorage.setItem(MUSIC_COMMAND_KEY, JSON.stringify(full))
  }

  // Write optimistic music state both to React state and to the shared
  // key, so the 500ms poll reads a consistent provider/status during the
  // window before the slideshow publishes the real state.
  const setMusicStateOptimistic = (next: MusicState) => {
    setMusicState(next)
    try {
      if (next.provider) localStorage.setItem(MUSIC_PROVIDER_KEY, next.provider)
      localStorage.setItem(MUSIC_STATE_KEY, JSON.stringify(next))
    } catch {
      // ignore
    }
  }

  const handleMusicLoadYouTubePlaylist = (playlist: YouTubePlaylistSummary) => {
    if (!slideshowOnline) openOutputWindow()
    setMusicUrl(playlist.playlistId)
    setMusicStateOptimistic({
      ...musicState,
      provider: "youtube",
      status: "loading",
      title: playlist.title,
      author: playlist.channelTitle,
      albumArtUrl: playlist.thumbnailUrl,
      uri: undefined,
      videoId: undefined,
      hasPlaylist: true,
      playlistVideoIds: undefined,
      playlistIndex: undefined,
      errorMessage: undefined,
    })
    sendMusicCommand({
      type: "load",
      provider: "youtube",
      playlistId: playlist.playlistId,
      title: playlist.title,
      author: playlist.channelTitle,
      thumbnailUrl: playlist.thumbnailUrl,
      autoplay: true,
    })
  }

  const handleMusicLoadYouTubeTrack = (
    track: YouTubePlaylistTrack,
    playlist: YouTubePlaylistSummary,
    index: number,
  ) => {
    if (!slideshowOnline) openOutputWindow()
    setMusicUrl(playlist.playlistId)
    setMusicStateOptimistic({
      ...musicState,
      provider: "youtube",
      status: "loading",
      title: track.title,
      author: track.author || playlist.channelTitle,
      albumArtUrl: track.thumbnailUrl,
      uri: undefined,
      videoId: track.videoId,
      hasPlaylist: true,
      playlistVideoIds: undefined,
      playlistIndex: index,
      errorMessage: undefined,
    })
    sendMusicCommand({
      type: "load",
      provider: "youtube",
      videoId: track.videoId,
      title: track.title,
      author: track.author || playlist.channelTitle,
      thumbnailUrl: track.thumbnailUrl,
      autoplay: true,
    })
  }

  const handleMusicLoadYouTubeVideo = (track: YouTubePlaylistTrack) => {
    if (!slideshowOnline) openOutputWindow()
    setMusicUrl(track.videoId)
    setMusicStateOptimistic({
      ...musicState,
      provider: "youtube",
      status: "loading",
      title: track.title,
      author: track.author,
      albumArtUrl: track.thumbnailUrl,
      uri: undefined,
      videoId: track.videoId,
      hasPlaylist: false,
      playlistVideoIds: undefined,
      playlistIndex: undefined,
      errorMessage: undefined,
    })
    sendMusicCommand({
      type: "load",
      provider: "youtube",
      videoId: track.videoId,
      autoplay: true,
    })
  }

  const handleMusicLoadSpotify = (
    uri: string,
    options?: { contextUri?: string; offsetUri?: string },
  ) => {
    const cmd = makeSpotifyLoadCommandFromRef(uri, options)
    if (!cmd) return
    if (!slideshowOnline) openOutputWindow()
    // When playing a track within a playlist, the context (playlist) is
    // what we persist + show as "now playing from", and next/prev work.
    const displayUri = options?.contextUri ?? uri
    setMusicUrl(displayUri)
    setMusicStateOptimistic({
      ...musicState,
      provider: "spotify",
      status: "loading",
      title: undefined,
      author: undefined,
      albumArtUrl: undefined,
      uri: displayUri,
      videoId: undefined,
      hasPlaylist: !!options?.contextUri,
      playlistVideoIds: undefined,
      playlistIndex: undefined,
      errorMessage: undefined,
    })
    sendMusicCommand(cmd)
  }

  const getActiveMusicProvider = () => musicState.provider ?? "youtube"
  const handleMusicPlay = () => sendMusicCommand({ type: "play", provider: getActiveMusicProvider() })
  const handleMusicPause = () => sendMusicCommand({ type: "pause", provider: getActiveMusicProvider() })
  const handleMusicNext = () => sendMusicCommand({ type: "next", provider: getActiveMusicProvider() })
  const handleMusicPrev = () => sendMusicCommand({ type: "prev", provider: getActiveMusicProvider() })
  const handleMusicPlayAt = (idx: number) =>
    sendMusicCommand({ type: "playAt", provider: getActiveMusicProvider(), index: idx })
  const handleMusicSeek = (seconds: number) => {
    setMusicState((s) => ({ ...s, currentTime: seconds }))
    sendMusicCommand({ type: "seek", provider: getActiveMusicProvider(), seconds })
  }
  const handleMusicVolume = (v: number) => {
    setMusicState((s) => ({ ...s, volume: v }))
    sendMusicCommand({ type: "volume", provider: getActiveMusicProvider(), value: v })
  }
  const handleMusicStop = () => {
    setMusicUrl(null)
    setMusicState((s) => ({ ...DEFAULT_MUSIC_STATE, volume: s.volume }))
    sendMusicCommand({ type: "stop", provider: getActiveMusicProvider() })
  }

  // ── Document title ─────────────────────────────────────────────────
  useEffect(() => {
    if (liveVerses[0]?.reference) {
      document.title = `${liveVerses[0].reference} · flowwww`
    } else if (selectedBook && selectedChapter) {
      document.title = `${selectedBook.name} ${selectedChapter} · flowwww`
    } else {
      document.title = "flowwww"
    }
  }, [liveVerses, selectedBook, selectedChapter])

  // ── Chapter fetch — single source for verse text ───────────────────
  useEffect(() => {
    if (!selectedBook || !selectedChapter) {
      setChapterVerses([])
      return
    }
    const verseCount = selectedBook.chapters[selectedChapter - 1]
    if (!verseCount) return

    const controller = new AbortController()
    setChapterLoading(true)
    setChapterError(null)
    ;(async () => {
      try {
        const cached = await getCachedChapter(version, selectedBook.name, selectedChapter)
        if (cached) {
          setChapterVerses(cached)
          setChapterLoading(false)
          return
        }
        const bookId = getBookId(selectedBook.name)
        const translation = getApiTranslationId(version)
        const url =
          verseCount === 1
            ? `${BIBLE_API_BASE}/verses/${bookId}.${selectedChapter}.1?translation=${translation}`
            : `${BIBLE_API_BASE}/verses/${bookId}.${selectedChapter}.1-${verseCount}?translation=${translation}`
        const res = await fetch(url, { signal: controller.signal })
        const data = await res.json()
        const verses: ChapterVerse[] = Array.isArray(data.verses)
          ? data.verses.map((v: { number: number; text: string }) => ({
              number: v.number,
              text: String(v.text).trim(),
            }))
          : data.text
            ? [{ number: 1, text: String(data.text).trim() }]
            : []
        if (verses.length === 0) {
          setChapterError("This chapter is not available in the selected translation.")
        } else {
          putCachedChapter(version, selectedBook.name, selectedChapter, verses)
        }
        setChapterVerses(verses)
      } catch (e) {
        if ((e as Error).name === "AbortError") return
        setChapterError("Couldn't load this chapter. Please check your connection.")
        setChapterVerses([])
      } finally {
        setChapterLoading(false)
      }
    })()

    return () => controller.abort()
  }, [selectedBook, selectedChapter, version])

  // ── Seed the bundled KJV translation into the offline cache once ───
  useEffect(() => {
    ;(async () => {
      try {
        if (await getVersionMeta("KJV")) return
        const res = await fetch("/bibles/kjv.json")
        if (!res.ok) return
        const data = await res.json()
        await hydrateTranslation("KJV", data.chapters)
      } catch {
        // asset may be absent in dev before the fetch script runs — ignore
      }
    })()
  }, [])

  // ── Build preview verses from cached chapter ───────────────────────
  const buildSelectedVerses = useCallback(
    (start: number, end: number): SelectedVerse[] => {
      if (!selectedBook || !selectedChapter || chapterVerses.length === 0) return []
      const items = chapterVerses.filter((v) => v.number >= start && v.number <= end)
      if (items.length === 0) return []
      if (start === end) {
        const v = items[0]
        return [
          {
            id: `${selectedBook.name}-${selectedChapter}-${v.number}`,
            book: selectedBook.name,
            chapter: selectedChapter,
            verse: v.number,
            text: v.text,
            reference: `${selectedBook.name} ${selectedChapter}:${v.number}`,
            version,
          },
        ]
      }
      const text = items
        .map(
          (v) =>
            `<sup class="text-blue-500 font-semibold mr-1">${v.number}</sup>${v.text}`,
        )
        .join(" ")
      return [
        {
          id: `${selectedBook.name}-${selectedChapter}-${start}-${end}`,
          book: selectedBook.name,
          chapter: selectedChapter,
          verse: start,
          text,
          reference: `${selectedBook.name} ${selectedChapter}:${start}-${end}`,
          version,
        },
      ]
    },
    [selectedBook, selectedChapter, chapterVerses, version],
  )

  // Whenever the underlying chapter changes, refresh the preview for the active selection
  useEffect(() => {
    if (rangeStartVerse !== null && rangeEndVerse !== null) {
      setPreviewVerses(buildSelectedVerses(rangeStartVerse, rangeEndVerse))
    } else if (selectedVerse !== null) {
      setPreviewVerses(buildSelectedVerses(selectedVerse, selectedVerse))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildSelectedVerses])

  // ── Bible selection handlers ───────────────────────────────────────
  const handleReferenceChange = (
    book: BibleBook | null,
    chapter: number | null,
    verse?: number,
  ) => {
    setSelectedBook(book ?? null)
    setSelectedChapter(chapter ?? null)
    setSelectedVerse(null)
    setRangeStartVerse(null)
    setRangeEndVerse(null)
    setPendingVerseSelection(verse ?? null)
  }

  // Apply a pending verse selection once the chapter text has loaded
  useEffect(() => {
    if (pendingVerseSelection === null) return
    if (chapterVerses.length === 0) return
    handleSelectVerse(pendingVerseSelection, false)
    setPendingVerseSelection(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterVerses, pendingVerseSelection])

  // Drive a jump from the typeahead all the way to live projection.
  const handleJumpProject = (
    book: BibleBook,
    chapter: number,
    verse: number,
  ) => {
    // Reuse the existing nav handler so the reader view + breadcrumb update.
    handleReferenceChange(book, chapter)
    setPendingProjectVerse({ book, chapter, verse })
  }

  // Once the chapter text for the target reference is loaded, build the verse,
  // push it to live, write to output, and record history. Require the
  // currently-loaded chapter to MATCH the pending reference so we don't
  // project stale text from a previously-viewed chapter.
  useEffect(() => {
    if (!pendingProjectVerse) return
    if (chapterVerses.length === 0) return
    if (
      !selectedBook ||
      selectedBook.name !== pendingProjectVerse.book.name ||
      selectedChapter !== pendingProjectVerse.chapter
    ) {
      return
    }
    const { verse } = pendingProjectVerse
    const list = buildSelectedVerses(verse, verse)
    if (list.length === 0) return
    setSelectedVerse(verse)
    setRangeStartVerse(verse)
    setRangeEndVerse(null)
    setPreviewMedia(null)
    setLiveMedia(null)
    setPreviewVerses(list)
    setLiveVerses(list)
    writeToOutput({ verses: list })
    list.forEach((v) => addToHistory(v.text, v.reference, v.version))
    setPendingProjectVerse(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterVerses, pendingProjectVerse, selectedBook, selectedChapter])

  const handleSelectVerse = (verse: number, shiftKey: boolean) => {
    if (!selectedBook || !selectedChapter) return
    if (shiftKey && rangeStartVerse !== null) {
      const start = Math.min(rangeStartVerse, verse)
      const end = Math.max(rangeStartVerse, verse)
      setRangeStartVerse(start)
      setRangeEndVerse(end)
      setSelectedVerse(verse)
      setPreviewVerses(buildSelectedVerses(start, end))
      return
    }
    setSelectedVerse(verse)
    setRangeStartVerse(verse)
    setRangeEndVerse(null)
    setPreviewVerses(buildSelectedVerses(verse, verse))
  }

  const handleDoubleClickVerse = (verse: number) => {
    if (!selectedBook || !selectedChapter) return
    if (
      rangeStartVerse !== null &&
      rangeEndVerse !== null &&
      verse >= rangeStartVerse &&
      verse <= rangeEndVerse
    ) {
      const list = buildSelectedVerses(rangeStartVerse, rangeEndVerse)
      if (list.length === 0) return
      setPreviewMedia(null)
      setLiveMedia(null)
      setLiveVerses(list)
      writeToOutput({ verses: list })
      list.forEach((v) => addToHistory(v.text, v.reference, v.version))
      return
    }
    const list = buildSelectedVerses(verse, verse)
    if (list.length === 0) return
    setSelectedVerse(verse)
    setRangeStartVerse(verse)
    setRangeEndVerse(null)
    setPreviewMedia(null)
    setLiveMedia(null)
    setPreviewVerses(list)
    setLiveVerses(list)
    writeToOutput({ verses: list })
    list.forEach((v) => addToHistory(v.text, v.reference, v.version))
  }

  // ── Full-text search result actions ────────────────────────────────
  const verseFromSearchResult = (r: ScriptureSearchResult): SelectedVerse => {
    const parsed = parseReference(r.reference)
    return {
      id: `search-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      book: parsed?.book.name ?? "",
      chapter: parsed?.chapter ?? 0,
      verse: parsed?.verse ?? 0,
      text: stripEm(r.text),
      reference: r.reference,
      version,
    }
  }

  const previewSearchResult = (r: ScriptureSearchResult) => {
    setPreviewMedia(null)
    setPreviewVerses([verseFromSearchResult(r)])
  }

  const projectSearchResult = (r: ScriptureSearchResult) => {
    const v = verseFromSearchResult(r)
    setPreviewMedia(null)
    setLiveMedia(null)
    setPreviewVerses([v])
    setLiveVerses([v])
    writeToOutput({ verses: [v] })
    addToHistory(v.text, v.reference, v.version)
    // Follow the projected verse in the reader so the Bible view matches.
    const parsed = parseReference(r.reference)
    if (parsed) handleReferenceChange(parsed.book, parsed.chapter, parsed.verse)
  }

  const queueSearchResult = (r: ScriptureSearchResult) => {
    addToQueue([verseFromSearchResult(r)])
  }

  // ── Slideshow projection ───────────────────────────────────────────
  // The slideshow reads backgroundColor/backgroundImage from their own
  // localStorage keys, so we deliberately omit them from this payload.
  // Including a large image data URL here can blow past the quota and
  // throw — silently dropping the projection.
  const writeToOutput = useCallback(
    ({
      verses = [],
      mediaId = null,
    }: {
      verses?: SelectedVerse[]
      mediaId?: string | null
    }) => {
      const data: VerseData = {
        verses,
        fontSize,
        darkMode: true,
        version,
        mediaId: mediaId ?? undefined,
      }
      try {
        localStorage.setItem("bibleVerseData", JSON.stringify(data))
      } catch (err) {
        console.error("flowwww: failed to write slide data", err)
      }
      window.dispatchEvent(new Event("storage"))
    },
    [fontSize, version],
  )

  const openOutputWindow = () => {
    const w = window.open(
      "/slideshow",
      "BibleSlideshow",
      "width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no",
    )
    if (w) setTimeout(() => writeToOutput({ verses: liveVerses, mediaId: liveMedia?.id ?? null }), 500)
  }

  // ── History ────────────────────────────────────────────────────────
  const addToHistory = (text: string, reference: string, itemVersion?: string) => {
    const newItem: HistoryItem = {
      id: `history-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      reference,
      text,
      timestamp: Date.now(),
      version: itemVersion,
    }
    setHistory((prev) => {
      const next = [
        newItem,
        ...prev.filter(
          (h) => !(h.text === text && h.reference === reference && h.version === itemVersion),
        ),
      ].slice(0, 30)
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      return next
    })
  }

  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem(HISTORY_KEY)
  }

  const projectFromHistory = (item: HistoryItem) => {
    const v: SelectedVerse = {
      id: `history-${Date.now()}`,
      book: "",
      chapter: 0,
      verse: 0,
      text: item.text,
      reference: item.reference,
      version: item.version || version,
    }
    setPreviewMedia(null)
    setLiveMedia(null)
    setPreviewVerses([v])
    setLiveVerses([v])
    writeToOutput({ verses: [v] })
  }

  // ── Go live ────────────────────────────────────────────────────────
  const goLive = useCallback(() => {
    // Media preview takes precedence if set; otherwise verses
    if (previewMedia) {
      setLiveVerses([])
      setLiveMedia(previewMedia)
      writeToOutput({ mediaId: previewMedia.id })
      return
    }
    if (previewVerses.length === 0) return
    setLiveMedia(null)
    setLiveVerses(previewVerses)
    writeToOutput({ verses: previewVerses })
    previewVerses.forEach((v) => addToHistory(v.text, v.reference, v.version))
  }, [previewVerses, previewMedia, writeToOutput])

  const clearLive = () => {
    setLiveVerses([])
    setLiveMedia(null)
    writeToOutput({})
  }

  // ── Queue helpers ──────────────────────────────────────────────────
  const addToQueue = (verses: SelectedVerse[]) => {
    if (verses.length === 0) return
    // Use unique queue-item IDs so the same verse can be queued multiple times
    const stamped = verses.map((v) => ({ ...v, id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }))
    setQueue((q) => [...q, ...stamped])
  }

  const queuePreviewItem = () => {
    addToQueue(previewVerses)
  }

  const queueVerseFromChapter = (verseNumber: number) => {
    const list = buildSelectedVerses(verseNumber, verseNumber)
    if (list.length === 0) return
    addToQueue(list)
  }

  const queueRemove = (id: string) => {
    setQueue((prev) => {
      const idx = prev.findIndex((v) => v.id === id)
      if (idx === -1) return prev
      const next = prev.filter((v) => v.id !== id)
      setQueueCursor((c) => {
        if (next.length === 0) return -1
        if (c === idx) return Math.min(c, next.length - 1)
        if (c > idx) return c - 1
        return c
      })
      return next
    })
  }

  const queueReorder = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return
    setQueue((prev) => {
      if (fromIdx >= prev.length || toIdx >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, item)
      setQueueCursor((c) => {
        if (c === fromIdx) return toIdx
        if (c > fromIdx && c <= toIdx) return c - 1
        if (c < fromIdx && c >= toIdx) return c + 1
        return c
      })
      return next
    })
  }

  const queueGoto = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= queue.length) return
      const item = queue[idx]
      setQueueCursor(idx)
      setPreviewMedia(null)
      setLiveMedia(null)
      setPreviewVerses([item])
      setLiveVerses([item])
      writeToOutput({ verses: [item] })
      addToHistory(item.text, item.reference, item.version)
    },
    [queue, writeToOutput],
  )

  const queuePreviewAt = (idx: number) => {
    if (idx < 0 || idx >= queue.length) return
    setPreviewMedia(null)
    setPreviewVerses([queue[idx]])
  }

  const queuePrev = useCallback(() => {
    if (queue.length === 0) return
    const next = queueCursor <= 0 ? 0 : queueCursor - 1
    queueGoto(next)
  }, [queue.length, queueCursor, queueGoto])

  const queueNext = useCallback(() => {
    if (queue.length === 0) return
    const next = queueCursor < 0 ? 0 : Math.min(queueCursor + 1, queue.length - 1)
    queueGoto(next)
  }, [queue.length, queueCursor, queueGoto])

  const clearQueue = () => {
    setQueue([])
    setQueueCursor(-1)
  }

  // ── Highlights ─────────────────────────────────────────────────────
  const applyHighlight = (color: string) => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return
    const range = selection.getRangeAt(0)
    const container = previewContentRef.current
    if (!container || !container.contains(range.commonAncestorContainer)) return
    let verseNode: HTMLElement | null = null
    let node: Node | null = range.commonAncestorContainer
    while (node && node !== container) {
      if (node instanceof HTMLElement && node.dataset.verseId) {
        verseNode = node
        break
      }
      node = node.parentNode
    }
    if (!verseNode) return
    const textEl = verseNode.querySelector<HTMLElement>("[data-verse-text]")
    if (!textEl || !textEl.contains(range.commonAncestorContainer)) return
    const mark = document.createElement("mark")
    mark.style.backgroundColor = color
    mark.style.color = "inherit"
    mark.style.padding = "0 2px"
    mark.style.borderRadius = "2px"
    try {
      range.surroundContents(mark)
    } catch {
      const frag = range.extractContents()
      mark.appendChild(frag)
      range.insertNode(mark)
    }
    const id = verseNode.dataset.verseId
    const html = textEl.innerHTML
    setPreviewVerses((prev) => prev.map((v) => (v.id === id ? { ...v, text: html } : v)))
    selection.removeAllRanges()
  }

  const clearHighlights = () => {
    const stripMarks = (html: string) =>
      html.replace(/<mark\b[^>]*>([\s\S]*?)<\/mark>/gi, "$1")
    setPreviewVerses((prev) => prev.map((v) => ({ ...v, text: stripMarks(v.text) })))
  }

  // ── Notes actions ──────────────────────────────────────────────────
  const composeNoteVerse = (): SelectedVerse | null => {
    if (!noteTitle.trim() && !noteText.trim()) return null
    return {
      id: `note-${Date.now()}`,
      book: "",
      chapter: 0,
      verse: 0,
      text: noteText.trim(),
      reference: noteTitle.trim() || "Note",
    }
  }

  const previewNote = () => {
    const v = composeNoteVerse()
    if (!v) return
    setPreviewMedia(null)
    setPreviewVerses([v])
  }
  const projectNote = () => {
    const v = composeNoteVerse()
    if (!v) return
    setLiveMedia(null)
    setLiveVerses([v])
    writeToOutput({ verses: [v] })
    addToHistory(v.text, v.reference, v.version)
  }
  const queueNote = () => {
    const v = composeNoteVerse()
    if (!v) return
    addToQueue([v])
  }

  // ── Saved notes (library, auto-saved) ──────────────────────────────
  // activeNoteIdRef mirrors activeNoteId synchronously so the debounced
  // autosave never creates a second note for the same draft.
  const persistCurrentEditor = useCallback((): string | null => {
    const title = noteTitle.trim()
    const body = noteText.trim()
    if (!title && !body) return null
    const now = Date.now()
    const currentId = activeNoteIdRef.current
    if (currentId) {
      // Only write (and bump updatedAt) if the content actually changed —
      // otherwise just viewing/switching a note would reorder the list.
      const existing = savedNotesRef.current.find((n) => n.id === currentId)
      if (existing && existing.title === noteTitle && existing.body === noteText) {
        return currentId
      }
      setSavedNotes((prev) =>
        prev.map((n) =>
          n.id === currentId ? { ...n, title: noteTitle, body: noteText, updatedAt: now } : n,
        ),
      )
      return currentId
    }
    const id = `note-${now}-${Math.random().toString(36).slice(2, 7)}`
    activeNoteIdRef.current = id
    setActiveNoteId(id)
    setSavedNotes((prev) => [
      { id, title: noteTitle, body: noteText, createdAt: now, updatedAt: now },
      ...prev,
    ])
    return id
  }, [noteTitle, noteText])

  // Debounced autosave — fires only when the editor differs from the
  // stored note (so loading a note doesn't bump its timestamp).
  useEffect(() => {
    if (!themeLoaded) return
    if (!noteTitle.trim() && !noteText.trim()) return
    const currentId = activeNoteIdRef.current
    const active = currentId ? savedNotes.find((n) => n.id === currentId) : undefined
    if (active && active.title === noteTitle && active.body === noteText) return
    const handle = setTimeout(() => persistCurrentEditor(), 600)
    return () => clearTimeout(handle)
  }, [noteTitle, noteText, themeLoaded, savedNotes, persistCurrentEditor])

  const selectNote = (note: SavedNote) => {
    if (note.id === activeNoteIdRef.current) return
    persistCurrentEditor()
    activeNoteIdRef.current = note.id
    setActiveNoteId(note.id)
    setNoteTitle(note.title)
    setNoteText(note.body)
  }

  const newNote = () => {
    persistCurrentEditor()
    activeNoteIdRef.current = null
    setActiveNoteId(null)
    setNoteTitle("")
    setNoteText("")
  }

  const deleteNote = (id: string) => {
    setSavedNotes((prev) => prev.filter((n) => n.id !== id))
    if (id === activeNoteIdRef.current) {
      activeNoteIdRef.current = null
      setActiveNoteId(null)
      setNoteTitle("")
      setNoteText("")
    }
  }

  // ── Media actions ──────────────────────────────────────────────────
  const handleMediaUpload = async (file: File) => {
    try {
      const imageId = await storeImage(file)
      setMedia((m) => [
        {
          id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          imageId,
          createdAt: Date.now(),
        },
        ...m,
      ])
    } catch (err) {
      console.error("flowwww: failed to store media", err)
    }
  }
  const deleteMedia = (id: string) => {
    const item = media.find((x) => x.id === id)
    if (item?.imageId) removeImage(item.imageId)
    setMedia((m) => m.filter((x) => x.id !== id))
  }
  const handlePreviewMedia = async (item: MediaItem) => {
    const url = await resolveImageUrl(item.imageId ?? item.dataUrl)
    if (!url) return
    setPreviewVerses([])
    setPreviewMedia({ id: item.imageId ?? item.dataUrl ?? "", url })
  }
  const handleProjectMedia = async (item: MediaItem) => {
    const ref = item.imageId ?? item.dataUrl ?? ""
    const url = await resolveImageUrl(ref)
    if (!url) return
    setPreviewVerses([])
    setLiveVerses([])
    setPreviewMedia({ id: ref, url })
    setLiveMedia({ id: ref, url })
    writeToOutput({ mediaId: ref })
  }

  // ── Background ─────────────────────────────────────────────────────
  const handleBackgroundUpload = async (file: File) => {
    try {
      const id = await storeImage(file)
      const url = await resolveImageUrl(id)
      setBackgroundImageId(id)
      setBackgroundImageUrl(url)
      setBackgroundKind(file.type.startsWith("video/") ? "video" : "image")
    } catch (err) {
      console.error("flowwww: failed to store background", err)
    }
  }
  const clearBackgroundImage = () => {
    setBackgroundImageId(null)
    setBackgroundImageUrl(null)
    setBackgroundKind(null)
  }
  const resetBackground = () => {
    setBackgroundColor("#000000")
    clearBackgroundImage()
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────
  // Space = go live · Esc = clear live · ←/→ = queue prev/next · [ / ] = chapter prev/next
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const editable = t && (/^(INPUT|TEXTAREA)$/.test(t.tagName) || t.isContentEditable)
      if (editable) return
      if (e.code === "Space") {
        e.preventDefault()
        goLive()
      } else if (e.key === "Escape") {
        e.preventDefault()
        clearLive()
      } else if (e.key === "ArrowRight") {
        if (queue.length === 0) return
        e.preventDefault()
        queueNext()
      } else if (e.key === "ArrowLeft") {
        if (queue.length === 0) return
        e.preventDefault()
        queuePrev()
      } else if (e.key === "]" && selectedBook && selectedChapter) {
        const next = getNextChapterRef(selectedBook, selectedChapter)
        if (next) {
          e.preventDefault()
          handleReferenceChange(next.book, next.chapter)
        }
      } else if (e.key === "[" && selectedBook && selectedChapter) {
        const prev = getPrevChapterRef(selectedBook, selectedChapter)
        if (prev) {
          e.preventDefault()
          handleReferenceChange(prev.book, prev.chapter)
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [goLive, queue.length, queueNext, queuePrev, selectedBook, selectedChapter])

  return (
    <div className="h-screen flex bg-background text-foreground">
      <LeftRail
        mode={mode}
        onModeChange={setMode}
        recent={history.slice(0, 12)}
        onSelectRecent={projectFromHistory}
        onClearRecent={clearHistory}
        queue={queue}
        queueCursor={queueCursor}
        onQueuePreviewAt={queuePreviewAt}
        onQueueProjectAt={queueGoto}
        onQueueRemove={queueRemove}
        onQueueReorder={queueReorder}
        onQueuePrev={queuePrev}
        onQueueNext={queueNext}
        onClearQueue={clearQueue}
      />

      <main className="flex-1 min-w-0 h-full overflow-hidden">
        {mode === "bible" && (
          <BiblePane
            selectedBook={selectedBook}
            selectedChapter={selectedChapter}
            selectedVerse={selectedVerse}
            rangeStartVerse={rangeStartVerse}
            rangeEndVerse={rangeEndVerse}
            version={version}
            chapterVerses={chapterVerses}
            chapterLoading={chapterLoading}
            chapterError={chapterError}
            onVersionChange={setVersion}
            onReferenceChange={handleReferenceChange}
            onJumpProject={handleJumpProject}
            onSelectVerse={handleSelectVerse}
            onDoubleClickVerse={handleDoubleClickVerse}
            onQueueVerse={queueVerseFromChapter}
            onPreviewSearchResult={previewSearchResult}
            onProjectSearchResult={projectSearchResult}
            onQueueSearchResult={queueSearchResult}
          />
        )}
        {mode === "notes" && (
          <NotesPane
            title={noteTitle}
            text={noteText}
            savedNotes={savedNotes}
            activeNoteId={activeNoteId}
            onTitleChange={setNoteTitle}
            onTextChange={setNoteText}
            onSelectNote={selectNote}
            onNewNote={newNote}
            onDeleteNote={deleteNote}
            onPreview={previewNote}
            onProject={projectNote}
            onAddToQueue={queueNote}
          />
        )}
        {mode === "media" && (
          <MediaPane
            items={media}
            onUpload={handleMediaUpload}
            onDelete={deleteMedia}
            onPreview={handlePreviewMedia}
            onProject={handleProjectMedia}
          />
        )}
      </main>

      <RightRail
        previewVerses={previewVerses}
        liveVerses={liveVerses}
        previewMediaUrl={previewMedia?.url ?? null}
        liveMediaUrl={liveMedia?.url ?? null}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        version={version}
        backgroundColor={backgroundColor}
        onBackgroundColorChange={setBackgroundColor}
        backgroundImage={backgroundImageUrl}
        backgroundKind={backgroundKind}
        onUploadBackground={handleBackgroundUpload}
        onClearBackground={clearBackgroundImage}
        onResetBackground={resetBackground}
        themeLoaded={themeLoaded}
        previewContentRef={previewContentRef}
        onGoLive={goLive}
        onClearLive={clearLive}
        onOpenOutput={openOutputWindow}
        onApplyHighlight={applyHighlight}
        onClearHighlights={clearHighlights}
        onAddPreviewToQueue={queuePreviewItem}
        musicState={musicState}
        musicUrl={musicUrl}
        slideshowOnline={slideshowOnline}
        youtubeStatus={youtubeStatus}
        onYouTubeStatusChange={setYouTubeStatus}
        spotifyStatus={spotifyStatus}
        onSpotifyStatusChange={setSpotifyStatus}
        onMusicLoadYouTubePlaylist={handleMusicLoadYouTubePlaylist}
        onMusicLoadYouTubeTrack={handleMusicLoadYouTubeTrack}
        onMusicLoadYouTubeVideo={handleMusicLoadYouTubeVideo}
        onMusicLoadSpotify={handleMusicLoadSpotify}
        onMusicPlay={handleMusicPlay}
        onMusicPause={handleMusicPause}
        onMusicNext={handleMusicNext}
        onMusicPrev={handleMusicPrev}
        onMusicPlayAt={handleMusicPlayAt}
        onMusicSeek={handleMusicSeek}
        onMusicVolume={handleMusicVolume}
        onMusicStop={handleMusicStop}
      />

      <CommandPalette
        version={version}
        onPreview={previewSearchResult}
        onProject={projectSearchResult}
        onQueue={queueSearchResult}
      />
    </div>
  )
}
