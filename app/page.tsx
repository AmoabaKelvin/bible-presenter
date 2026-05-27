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
import { LeftRail } from "@/components/operator/left-rail"
import { BiblePane } from "@/components/operator/bible-pane"
import { NotesPane } from "@/components/operator/notes-pane"
import { MediaPane } from "@/components/operator/media-pane"
import { RightRail } from "@/components/operator/right-rail"
import type { ChapterVerse } from "@/components/operator/chapter-reader"
import type { HistoryItem, MediaItem, Mode, VerseData } from "@/components/operator/types"
import {
  DEFAULT_MUSIC_STATE,
  MUSIC_COMMAND_KEY,
  MUSIC_STATE_KEY,
  MUSIC_URL_KEY,
  MUSIC_VOLUME_KEY,
  type MusicCommand,
  type MusicState,
  makeCommandId,
  parseYouTubeUrl,
} from "@/lib/youtube-music"

const HISTORY_KEY = "biblePresenterHistory"
const VERSION_KEY = "bibleVersion"
const BG_COLOR_KEY = "biblePresenterBackgroundColor"
const BG_IMAGE_KEY = "biblePresenterBackgroundImage"
const MEDIA_KEY = "biblePresenterMedia"
const QUEUE_KEY = "biblePresenterQueue"
const QUEUE_CURSOR_KEY = "biblePresenterQueueCursor"

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

  // Presentation
  const [previewVerses, setPreviewVerses] = useState<SelectedVerse[]>([])
  const [liveVerses, setLiveVerses] = useState<SelectedVerse[]>([])
  const [previewMediaUrl, setPreviewMediaUrl] = useState<string | null>(null)
  const [liveMediaUrl, setLiveMediaUrl] = useState<string | null>(null)
  const [queue, setQueue] = useState<SelectedVerse[]>([])
  const [queueCursor, setQueueCursor] = useState(-1)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [media, setMedia] = useState<MediaItem[]>([])

  // Settings
  const [fontSize, setFontSize] = useState<FontSize>("extra-large")
  const [version, setVersion] = useState("KJV")
  const [backgroundColor, setBackgroundColor] = useState("#000000")
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null)
  const [themeLoaded, setThemeLoaded] = useState(false)

  // Notes
  const [noteTitle, setNoteTitle] = useState("")
  const [noteText, setNoteText] = useState("")

  // Music
  const [musicUrl, setMusicUrl] = useState<string | null>(null)
  const [musicState, setMusicState] = useState<MusicState>(DEFAULT_MUSIC_STATE)

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
      if (bgImg) setBackgroundImage(bgImg)
      const m = localStorage.getItem(MEDIA_KEY)
      if (m) setMedia(JSON.parse(m))
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
    if (backgroundImage) localStorage.setItem(BG_IMAGE_KEY, backgroundImage)
    else localStorage.removeItem(BG_IMAGE_KEY)
  }, [backgroundImage, themeLoaded])
  useEffect(() => {
    if (themeLoaded) localStorage.setItem(MEDIA_KEY, JSON.stringify(media))
  }, [media, themeLoaded])
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

  // Send a music command (the slideshow tab handles it)
  const sendMusicCommand = (cmd: Omit<MusicCommand, "id">) => {
    const full = { ...cmd, id: makeCommandId() } as MusicCommand
    localStorage.setItem(MUSIC_COMMAND_KEY, JSON.stringify(full))
  }

  const handleMusicLoad = (rawUrl: string) => {
    const parsed = parseYouTubeUrl(rawUrl)
    if (!parsed) return
    setMusicUrl(rawUrl)
    setMusicState((s) => ({ ...s, status: "loading", title: undefined, hasPlaylist: !!parsed.playlistId }))
    sendMusicCommand({
      type: "load",
      url: rawUrl,
      videoId: parsed.videoId,
      playlistId: parsed.playlistId,
      autoplay: true,
    })
  }

  const handleMusicPlay = () => sendMusicCommand({ type: "play" })
  const handleMusicPause = () => sendMusicCommand({ type: "pause" })
  const handleMusicNext = () => sendMusicCommand({ type: "next" })
  const handleMusicPrev = () => sendMusicCommand({ type: "prev" })
  const handleMusicVolume = (v: number) => {
    setMusicState((s) => ({ ...s, volume: v }))
    sendMusicCommand({ type: "volume", value: v })
  }
  const handleMusicStop = () => {
    setMusicUrl(null)
    setMusicState((s) => ({ ...DEFAULT_MUSIC_STATE, volume: s.volume }))
    sendMusicCommand({ type: "stop" })
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
      setPreviewMediaUrl(null)
      setLiveMediaUrl(null)
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
    setPreviewMediaUrl(null)
    setLiveMediaUrl(null)
    setPreviewVerses(list)
    setLiveVerses(list)
    writeToOutput({ verses: list })
    list.forEach((v) => addToHistory(v.text, v.reference, v.version))
  }

  // ── Slideshow projection ───────────────────────────────────────────
  const writeToOutput = useCallback(
    ({
      verses = [],
      mediaUrl = null,
    }: {
      verses?: SelectedVerse[]
      mediaUrl?: string | null
    }) => {
      const data: VerseData = {
        verses,
        fontSize,
        darkMode: true,
        version,
        backgroundColor,
        backgroundImage: backgroundImage ?? undefined,
        mediaUrl: mediaUrl ?? undefined,
      }
      localStorage.setItem("bibleVerseData", JSON.stringify(data))
      window.dispatchEvent(new Event("storage"))
    },
    [fontSize, version, backgroundColor, backgroundImage],
  )

  const openOutputWindow = () => {
    const w = window.open(
      "/slideshow",
      "BibleSlideshow",
      "width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no",
    )
    if (w) setTimeout(() => writeToOutput({ verses: liveVerses, mediaUrl: liveMediaUrl }), 500)
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
    setPreviewMediaUrl(null)
    setLiveMediaUrl(null)
    setPreviewVerses([v])
    setLiveVerses([v])
    writeToOutput({ verses: [v] })
  }

  // ── Go live ────────────────────────────────────────────────────────
  const goLive = useCallback(() => {
    // Media preview takes precedence if set; otherwise verses
    if (previewMediaUrl) {
      setLiveVerses([])
      setLiveMediaUrl(previewMediaUrl)
      writeToOutput({ mediaUrl: previewMediaUrl })
      return
    }
    if (previewVerses.length === 0) return
    setLiveMediaUrl(null)
    setLiveVerses(previewVerses)
    writeToOutput({ verses: previewVerses })
    previewVerses.forEach((v) => addToHistory(v.text, v.reference, v.version))
  }, [previewVerses, previewMediaUrl, writeToOutput])

  const clearLive = () => {
    setLiveVerses([])
    setLiveMediaUrl(null)
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
      setPreviewMediaUrl(null)
      setLiveMediaUrl(null)
      setPreviewVerses([item])
      setLiveVerses([item])
      writeToOutput({ verses: [item] })
      addToHistory(item.text, item.reference, item.version)
    },
    [queue, writeToOutput],
  )

  const queuePreviewAt = (idx: number) => {
    if (idx < 0 || idx >= queue.length) return
    setPreviewMediaUrl(null)
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
    setPreviewMediaUrl(null)
    setPreviewVerses([v])
  }
  const projectNote = () => {
    const v = composeNoteVerse()
    if (!v) return
    setLiveMediaUrl(null)
    setLiveVerses([v])
    writeToOutput({ verses: [v] })
    addToHistory(v.text, v.reference, v.version)
  }
  const queueNote = () => {
    const v = composeNoteVerse()
    if (!v) return
    addToQueue([v])
    setNoteText("")
    setNoteTitle("")
  }

  // ── Media actions ──────────────────────────────────────────────────
  const addMedia = (item: MediaItem) => setMedia((m) => [item, ...m])
  const deleteMedia = (id: string) => setMedia((m) => m.filter((x) => x.id !== id))
  const previewMedia = (item: MediaItem) => {
    setPreviewVerses([])
    setPreviewMediaUrl(item.dataUrl)
  }
  const projectMedia = (item: MediaItem) => {
    setPreviewVerses([])
    setLiveVerses([])
    setPreviewMediaUrl(item.dataUrl)
    setLiveMediaUrl(item.dataUrl)
    writeToOutput({ mediaUrl: item.dataUrl })
  }

  // ── Background ─────────────────────────────────────────────────────
  const resetBackground = () => {
    setBackgroundColor("#000000")
    setBackgroundImage(null)
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
        musicState={musicState}
        musicUrl={musicUrl}
        onMusicLoad={handleMusicLoad}
        onMusicPlay={handleMusicPlay}
        onMusicPause={handleMusicPause}
        onMusicNext={handleMusicNext}
        onMusicPrev={handleMusicPrev}
        onMusicVolume={handleMusicVolume}
        onMusicStop={handleMusicStop}
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
            onSelectVerse={handleSelectVerse}
            onDoubleClickVerse={handleDoubleClickVerse}
            onQueueVerse={queueVerseFromChapter}
          />
        )}
        {mode === "notes" && (
          <NotesPane
            title={noteTitle}
            text={noteText}
            onTitleChange={setNoteTitle}
            onTextChange={setNoteText}
            onPreview={previewNote}
            onProject={projectNote}
            onAddToQueue={queueNote}
          />
        )}
        {mode === "media" && (
          <MediaPane
            items={media}
            onUpload={addMedia}
            onDelete={deleteMedia}
            onPreview={previewMedia}
            onProject={projectMedia}
          />
        )}
      </main>

      <RightRail
        previewVerses={previewVerses}
        liveVerses={liveVerses}
        previewMediaUrl={previewMediaUrl}
        liveMediaUrl={liveMediaUrl}
        queue={queue}
        queueCursor={queueCursor}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        version={version}
        backgroundColor={backgroundColor}
        onBackgroundColorChange={setBackgroundColor}
        backgroundImage={backgroundImage}
        onBackgroundImageChange={setBackgroundImage}
        onResetBackground={resetBackground}
        themeLoaded={themeLoaded}
        previewContentRef={previewContentRef}
        onGoLive={goLive}
        onClearLive={clearLive}
        onOpenOutput={openOutputWindow}
        onApplyHighlight={applyHighlight}
        onClearHighlights={clearHighlights}
        onAddPreviewToQueue={queuePreviewItem}
        onQueuePreviewAt={queuePreviewAt}
        onQueueProjectAt={queueGoto}
        onQueueRemove={queueRemove}
        onQueueReorder={queueReorder}
        onQueuePrev={queuePrev}
        onQueueNext={queueNext}
        onClearQueue={clearQueue}
      />
    </div>
  )
}
