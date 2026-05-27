"use client"

import { useState, useEffect, useRef } from "react"
import ReactMarkdown from "react-markdown"
import rehypeRaw from "rehype-raw"
import { HexColorPicker } from "react-colorful"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ExternalLink, Moon, Sun, Book, BookOpen, Loader2, X, XCircle, Plus, FileText, History, Bold, Italic, Underline, List, ListOrdered, Check, ImageIcon, RotateCcw, Highlighter } from "lucide-react"
import {
  oldTestament,
  newTestament,
  getBookId,
  stripStrongsNumbers,
  BIBLE_VERSIONS,
  type BibleBook,
} from "@/lib/bible-data"

type FontSize = "small" | "medium" | "large" | "extra-large"

interface SelectedVerse {
  id: string
  book: string
  chapter: number
  verse: number
  text: string
  reference: string
  version?: string
}

interface VerseData {
  verses: SelectedVerse[]
  fontSize: FontSize
  darkMode: boolean
  version: string
  backgroundColor?: string
  backgroundImage?: string
}

interface HistoryItem {
  id: string
  text: string
  reference: string
  timestamp: number
}

export default function ControlPanel() {
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null)
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null)
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null)
  const [rangeStartVerse, setRangeStartVerse] = useState<number | null>(null)
  const [rangeEndVerse, setRangeEndVerse] = useState<number | null>(null)
  const [currentVerseText, setCurrentVerseText] = useState("")
  const [currentReference, setCurrentReference] = useState("")
  const [selectedVerses, setSelectedVerses] = useState<SelectedVerse[]>([])
  const [fontSize, setFontSize] = useState<FontSize>("extra-large") // default to extra-large
  const [darkMode, setDarkMode] = useState(true)
  const [backgroundColor, setBackgroundColor] = useState("#000000")
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [themeLoaded, setThemeLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [slideshowWindow, setSlideshowWindow] = useState<Window | null>(null)
  const [liveVerses, setLiveVerses] = useState<SelectedVerse[]>([])
  const [previewVerses, setPreviewVerses] = useState<SelectedVerse[]>([])

  const [customNoteTitle, setCustomNoteTitle] = useState("")
  const [customNoteText, setCustomNoteText] = useState("")
  const [activeTab, setActiveTab] = useState("bible")
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [selectedVersion, setSelectedVersion] = useState("KJV")
  const [bookSearch, setBookSearch] = useState("")
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null)
  const previewContentRef = useRef<HTMLDivElement>(null)

  const HIGHLIGHT_COLORS = [
    { value: "rgba(250, 204, 21, 0.55)", swatch: "#facc15", label: "Yellow" },
    { value: "rgba(74, 222, 128, 0.55)", swatch: "#4ade80", label: "Green" },
    { value: "rgba(96, 165, 250, 0.55)", swatch: "#60a5fa", label: "Blue" },
    { value: "rgba(244, 114, 182, 0.55)", swatch: "#f472b6", label: "Pink" },
    { value: "rgba(251, 146, 60, 0.55)", swatch: "#fb923c", label: "Orange" },
  ]

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

    const verseId = verseNode.dataset.verseId
    const newHtml = textEl.innerHTML
    setPreviewVerses((prev) => prev.map((v) => (v.id === verseId ? { ...v, text: newHtml } : v)))
    selection.removeAllRanges()
  }

  const clearHighlights = () => {
    const stripMarks = (html: string) =>
      html.replace(/<mark\b[^>]*>([\s\S]*?)<\/mark>/gi, "$1")
    setPreviewVerses((prev) => prev.map((v) => ({ ...v, text: stripMarks(v.text) })))
  }

  const insertFormatting = (prefix: string, suffix: string = prefix) => {
    const textarea = noteTextareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = customNoteText
    const selectedText = text.substring(start, end)

    const newText = text.substring(0, start) + prefix + selectedText + suffix + text.substring(end)
    setCustomNoteText(newText)

    // Restore focus and selection
    setTimeout(() => {
      textarea.focus()
      if (selectedText) {
        textarea.setSelectionRange(start + prefix.length, end + prefix.length)
      } else {
        textarea.setSelectionRange(start + prefix.length, start + prefix.length)
      }
    }, 0)
  }

  useEffect(() => {
    const savedHistory = localStorage.getItem("biblePresenterHistory")
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory))
    }
    const savedVersion = localStorage.getItem("bibleVersion")
    if (savedVersion) {
      setSelectedVersion(savedVersion)
    }
    const savedDarkMode = localStorage.getItem("biblePresenterDarkMode")
    if (savedDarkMode !== null) {
      setDarkMode(JSON.parse(savedDarkMode))
    }
    const savedBackgroundColor = localStorage.getItem("biblePresenterBackgroundColor")
    if (savedBackgroundColor) {
      setBackgroundColor(savedBackgroundColor)
    }
    const savedBackgroundImage = localStorage.getItem("biblePresenterBackgroundImage")
    if (savedBackgroundImage) {
      setBackgroundImage(savedBackgroundImage)
    }
    setThemeLoaded(true)
  }, [])

  useEffect(() => {
    localStorage.setItem("bibleVersion", selectedVersion)
  }, [selectedVersion])

  useEffect(() => {
    localStorage.setItem("biblePresenterDarkMode", JSON.stringify(darkMode))
  }, [darkMode])

  useEffect(() => {
    localStorage.setItem("biblePresenterBackgroundColor", backgroundColor)
  }, [backgroundColor])

  useEffect(() => {
    if (backgroundImage) {
      localStorage.setItem("biblePresenterBackgroundImage", backgroundImage)
    } else {
      localStorage.removeItem("biblePresenterBackgroundImage")
    }
  }, [backgroundImage])

  const addToHistory = (text: string, reference: string) => {
    const newItem: HistoryItem = {
      id: `history-${Date.now()}`,
      text,
      reference,
      timestamp: Date.now(),
    }
    const updatedHistory = [newItem, ...history.filter((h) => h.text !== text || h.reference !== reference)].slice(
      0,
      50,
    )
    setHistory(updatedHistory)
    localStorage.setItem("biblePresenterHistory", JSON.stringify(updatedHistory))
  }

  const projectFromHistory = (item: HistoryItem) => {
    const verse: SelectedVerse = {
      id: `history-${Date.now()}`,
      book: "",
      chapter: 0,
      verse: 0,
      text: item.text,
      reference: item.reference,
    }
    const data: VerseData = {
      verses: [verse],
      fontSize,
      darkMode,
      version: selectedVersion,
      backgroundColor,
      backgroundImage: backgroundImage || undefined,
    }
    localStorage.setItem("bibleVerseData", JSON.stringify(data))
    window.dispatchEvent(new Event("storage"))
    setLiveVerses([verse])
  }

  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem("biblePresenterHistory")
  }

  useEffect(() => {
    const updateFaviconAndTitle = () => {
      const canvas = document.createElement("canvas")
      canvas.width = 32
      canvas.height = 32
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.fillStyle = "#3b82f6"
        ctx.fillRect(0, 0, 32, 32)
        ctx.fillStyle = "#ffffff"
        ctx.font = "bold 20px sans-serif"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText("C", 16, 17)

        const link = document.querySelector("link[rel='icon']") as HTMLLinkElement
        if (link) {
          link.href = canvas.toDataURL()
        } else {
          const newLink = document.createElement("link")
          newLink.rel = "icon"
          newLink.href = canvas.toDataURL()
          document.head.appendChild(newLink)
        }
      }

      if (currentReference) {
        document.title = `${currentReference} - Control Panel`
      } else if (selectedBook) {
        document.title = `${selectedBook.name} - Control Panel`
      } else {
        document.title = "Bible Presenter - Control Panel"
      }
    }

    updateFaviconAndTitle()
  }, [currentReference, selectedBook])

  useEffect(() => {
    if (selectedBook && selectedChapter) {
      // If a range is selected, re-fetch the entire range
      if (rangeStartVerse !== null && rangeEndVerse !== null) {
        fetchVerseRange(selectedBook.name, selectedChapter, rangeStartVerse, rangeEndVerse)
      } else if (selectedVerse) {
        fetchVerse(selectedBook.name, selectedChapter, selectedVerse)
      }
    }
  }, [selectedBook, selectedChapter, selectedVerse, rangeStartVerse, rangeEndVerse, selectedVersion])

  const fetchVerse = async (book: string, chapter: number, verse: number) => {
    setLoading(true)
    try {
      const bookId = getBookId(book)
      const response = await fetch(
        `https://bolls.life/get-verse/${selectedVersion}/${bookId}/${chapter}/${verse}/`
      )
      const data = await response.json()
      if (data.text) {
        const verseText = stripStrongsNumbers(data.text).trim()
        const reference = `${book} ${chapter}:${verse}`
        setCurrentVerseText(verseText)
        setCurrentReference(reference)
        // Update previewVerses so the UI reflects the new version
        const newVerse: SelectedVerse = {
          id: `${book}-${chapter}-${verse}`,
          book,
          chapter,
          verse,
          text: verseText,
          reference,
          version: selectedVersion,
        }
        setPreviewVerses([newVerse])
      } else {
        setCurrentVerseText("Verse not found")
        setCurrentReference(`${book} ${chapter}:${verse}`)
      }
    } catch (error) {
      setCurrentVerseText("Error fetching verse. Please try again.")
      setCurrentReference(`${book} ${chapter}:${verse}`)
    }
    setLoading(false)
  }

  const fetchVerseRange = async (book: string, chapter: number, startVerse: number, endVerse: number) => {
    setLoading(true)
    try {
      const bookId = getBookId(book)
      const verses: SelectedVerse[] = []
      const texts: string[] = []

      // Fetch all verses in the range
      for (let v = startVerse; v <= endVerse; v++) {
        const response = await fetch(
          `https://bolls.life/get-verse/${selectedVersion}/${bookId}/${chapter}/${v}/`
        )
        const data = await response.json()
        if (data.text) {
          const verseText = stripStrongsNumbers(data.text).trim()
          texts.push(`<sup class="text-blue-500 font-semibold mr-1">${v}</sup>${verseText}`)
          verses.push({
            id: `${book}-${chapter}-${v}`,
            book,
            chapter,
            verse: v,
            text: verseText,
            reference: `${book} ${chapter}:${v}`,
            version: selectedVersion,
          })
        }
      }

      if (texts.length > 0) {
        // Combine all verse texts
        const combinedText = texts.join(" ")
        const reference = startVerse === endVerse
          ? `${book} ${chapter}:${startVerse}`
          : `${book} ${chapter}:${startVerse}-${endVerse}`

        setCurrentVerseText(combinedText)
        setCurrentReference(reference)

        // Create a single combined verse for preview
        const combinedVerse: SelectedVerse = {
          id: `${book}-${chapter}-${startVerse}-${endVerse}`,
          book,
          chapter,
          verse: startVerse,
          text: combinedText,
          reference,
          version: selectedVersion,
        }
        setPreviewVerses([combinedVerse])
      }
    } catch (error) {
      setCurrentVerseText("Error fetching verses. Please try again.")
      setCurrentReference(`${book} ${chapter}:${startVerse}-${endVerse}`)
    }
    setLoading(false)
  }

  const addVerseToSelection = () => {
    if (!selectedBook || !selectedChapter || !selectedVerse || !currentVerseText) return

    const id = `${selectedBook.name}-${selectedChapter}-${selectedVerse}`
    if (selectedVerses.some((v) => v.id === id)) return

    const newVerse: SelectedVerse = {
      id,
      book: selectedBook.name,
      chapter: selectedChapter,
      verse: selectedVerse,
      text: currentVerseText,
      reference: currentReference,
    }
    setSelectedVerses([...selectedVerses, newVerse])
  }

  const removeVerse = (id: string) => {
    setSelectedVerses(selectedVerses.filter((v) => v.id !== id))
  }

  const clearAllVerses = () => {
    setSelectedVerses([])
  }

  const openSlideshowWindow = () => {
    const newWindow = window.open(
      "/slideshow",
      "BibleSlideshow",
      "width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no",
    )
    setSlideshowWindow(newWindow)
    setTimeout(() => {
      updateSlide()
    }, 500)
  }

  const clearDisplay = () => {
    setLiveVerses([])
    const data: VerseData = {
      verses: [],
      fontSize,
      darkMode,
      version: selectedVersion,
    }
    localStorage.setItem("bibleVerseData", JSON.stringify(data))
    window.dispatchEvent(new Event("storage"))
  }

  const updateSlide = () => {
    const versesToProject =
      selectedVerses.length > 0
        ? selectedVerses
        : previewVerses.length > 0
          ? previewVerses
          : currentVerseText
            ? [
                {
                  id: "single",
                  book: selectedBook?.name || "",
                  chapter: selectedChapter || 0,
                  verse: selectedVerse || 0,
                  text: currentVerseText,
                  reference: currentReference,
                  version: selectedVersion,
                },
              ]
            : []

    const data: VerseData = {
      verses: versesToProject,
      fontSize,
      darkMode,
      version: selectedVersion,
      backgroundColor,
      backgroundImage: backgroundImage || undefined,
    }
    localStorage.setItem("bibleVerseData", JSON.stringify(data))
    window.dispatchEvent(new Event("storage"))

    setLiveVerses(versesToProject)

    if (selectedVerses.length > 0) {
      selectedVerses.forEach((v) => addToHistory(v.text, v.reference))
    } else if (currentVerseText) {
      addToHistory(currentVerseText, currentReference)
    }
  }

  const projectCustomNote = () => {
    if (!customNoteText.trim() && !customNoteTitle.trim()) return

    const noteVerse: SelectedVerse = {
      id: `note-${Date.now()}`,
      book: "",
      chapter: 0,
      verse: 0,
      text: customNoteText.trim(),
      reference: customNoteTitle.trim(),
    }

    const noteData: VerseData = {
      verses: [noteVerse],
      fontSize,
      darkMode,
      version: selectedVersion,
      backgroundColor,
      backgroundImage: backgroundImage || undefined,
    }
    localStorage.setItem("bibleVerseData", JSON.stringify(noteData))
    window.dispatchEvent(new Event("storage"))

    setLiveVerses([noteVerse])

    addToHistory(customNoteText.trim() || customNoteTitle.trim(), customNoteTitle.trim() || "Note")
  }

  const addCustomNoteToQueue = () => {
    if (!customNoteText.trim() && !customNoteTitle.trim()) return

    const newNote: SelectedVerse = {
      id: `note-${Date.now()}`,
      book: "",
      chapter: 0,
      verse: 0,
      text: customNoteText.trim(),
      reference: customNoteTitle.trim() || "Note",
    }
    setSelectedVerses([...selectedVerses, newNote])
    setCustomNoteText("")
    setCustomNoteTitle("")
  }

  const previewNote = () => {
    if (!customNoteText.trim() && !customNoteTitle.trim()) return
    const noteVerse: SelectedVerse = {
      id: `note-${Date.now()}`,
      book: "",
      chapter: 0,
      verse: 0,
      text: customNoteText.trim(),
      reference: customNoteTitle.trim(),
    }
    setPreviewVerses([noteVerse])
  }

  const isNote = (verse: SelectedVerse) => verse.id.startsWith("note-") || verse.id.startsWith("history-")

  const fontSizeOptions: { value: FontSize; label: string }[] = [
    { value: "small", label: "S" },
    { value: "medium", label: "M" },
    { value: "large", label: "L" },
    { value: "extra-large", label: "XL" },
  ]

  const colorPalette = [
    { value: "#000000", label: "Black" },
    { value: "#FFFFFF", label: "White" },
    { value: "#1e3a5f", label: "Navy" },
    { value: "#0f172a", label: "Slate" },
    { value: "#1a1a2e", label: "Dark Purple" },
    { value: "#0d1b2a", label: "Deep Blue" },
    { value: "#2d1b4e", label: "Plum" },
    { value: "#1b4332", label: "Forest" },
    { value: "#3d0c02", label: "Maroon" },
    { value: "#1c1917", label: "Stone" },
  ]

  const handleColorSelect = (color: string) => {
    setBackgroundColor(color)
    setBackgroundImage(null) // Clear image when selecting a color
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target?.result as string
        setBackgroundImage(base64)
      }
      reader.readAsDataURL(file)
    }
    // Reset input so same file can be selected again
    e.target.value = ""
  }

  const handleResetBackground = () => {
    setBackgroundColor("#000000")
    setBackgroundImage(null)
  }

  const getTextColorForBackground = (bgColor: string) => {
    // Convert hex to RGB
    const hex = bgColor.replace("#", "")
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5 ? "text-gray-900" : "text-white"
  }

  const getReferenceColorForBackground = (bgColor: string) => {
    const hex = bgColor.replace("#", "")
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5 ? "text-gray-600" : "text-gray-400"
  }

  // Filter books based on search query
  const filteredOldTestament = oldTestament.filter((book) =>
    book.name.toLowerCase().includes(bookSearch.toLowerCase())
  )
  const filteredNewTestament = newTestament.filter((book) =>
    book.name.toLowerCase().includes(bookSearch.toLowerCase())
  )

  const handleBookSelect = (book: BibleBook) => {
    setSelectedBook(book)
    setSelectedChapter(null)
    setSelectedVerse(null)
    setRangeStartVerse(null)
    setRangeEndVerse(null)
    setCurrentVerseText("")
    setCurrentReference("")
    setBookSearch("")
  }

  const handleChapterSelect = (chapter: number) => {
    setSelectedChapter(chapter)
    setSelectedVerse(null)
    setRangeStartVerse(null)
    setRangeEndVerse(null)
    setCurrentVerseText("")
    setCurrentReference("")
  }

  const handleVerseSelect = async (verse: number, event?: React.MouseEvent) => {
    if (!selectedBook || !selectedChapter) return

    // Shift+click for range selection
    if (event?.shiftKey && rangeStartVerse !== null) {
      const start = Math.min(rangeStartVerse, verse)
      const end = Math.max(rangeStartVerse, verse)
      setRangeEndVerse(end)
      setRangeStartVerse(start)
      setSelectedVerse(verse)
      await fetchVerseRange(selectedBook.name, selectedChapter, start, end)
      return
    }

    // Regular click - set as start of potential range
    setSelectedVerse(verse)
    setRangeStartVerse(verse)
    setRangeEndVerse(null)
    setLoading(true)

    try {
      const bookId = getBookId(selectedBook.name)
      const response = await fetch(
        `https://bolls.life/get-verse/${selectedVersion}/${bookId}/${selectedChapter}/${verse}/`
      )
      const data = await response.json()

      if (data.text) {
        const verseText = stripStrongsNumbers(data.text).trim()
        const reference = `${selectedBook.name} ${selectedChapter}:${verse}`

        setCurrentVerseText(verseText)
        setCurrentReference(reference)

        const newVerse: SelectedVerse = {
          id: `${selectedBook.name}-${selectedChapter}-${verse}`,
          book: selectedBook.name,
          chapter: selectedChapter,
          verse: verse,
          text: verseText,
          reference: reference,
          version: selectedVersion,
        }
        setPreviewVerses([newVerse])
      }
    } catch (error) {
      setCurrentVerseText("Error fetching verse. Please try again.")
    }
    setLoading(false)
  }

  const handleVerseDoubleClick = async (verse: number) => {
    if (!selectedBook || !selectedChapter) return

    // If there's a range selected and double-clicking on a verse in that range, go live with the range
    if (rangeStartVerse !== null && rangeEndVerse !== null &&
        verse >= rangeStartVerse && verse <= rangeEndVerse &&
        previewVerses.length > 0) {
      setLiveVerses([...previewVerses])
      const verseData: VerseData = {
        verses: previewVerses,
        fontSize,
        darkMode,
        version: selectedVersion,
        backgroundColor,
        backgroundImage: backgroundImage || undefined,
      }
      localStorage.setItem("bibleVerseData", JSON.stringify(verseData))
      window.dispatchEvent(new Event("storage"))
      previewVerses.forEach((v) => addToHistory(v.text, v.reference))
      return
    }

    setSelectedVerse(verse)
    setRangeStartVerse(verse)
    setRangeEndVerse(null)
    setLoading(true)

    try {
      const bookId = getBookId(selectedBook.name)
      const response = await fetch(
        `https://bolls.life/get-verse/${selectedVersion}/${bookId}/${selectedChapter}/${verse}/`
      )
      const data = await response.json()

      if (data.text) {
        const verseText = stripStrongsNumbers(data.text).trim()
        const reference = `${selectedBook.name} ${selectedChapter}:${verse}`

        setCurrentVerseText(verseText)
        setCurrentReference(reference)

        const newVerse: SelectedVerse = {
          id: `${selectedBook.name}-${selectedChapter}-${verse}`,
          book: selectedBook.name,
          chapter: selectedChapter,
          verse: verse,
          text: verseText,
          reference: reference,
          version: selectedVersion,
        }
        setPreviewVerses([newVerse])
        setLiveVerses([newVerse])

        const verseData: VerseData = {
          verses: [newVerse],
          fontSize,
          darkMode,
          version: selectedVersion,
          backgroundColor,
          backgroundImage: backgroundImage || undefined,
        }
        localStorage.setItem("bibleVerseData", JSON.stringify(verseData))
        window.dispatchEvent(new Event("storage"))

        addToHistory(verseText, reference)
      }
    } catch (error) {
      setCurrentVerseText("Error fetching verse. Please try again.")
    }
    setLoading(false)
  }

  const goLive = () => {
    if (previewVerses.length > 0) {
      setLiveVerses([...previewVerses])
      updateSlide()
    } else if (currentVerseText) {
      const newVerse: SelectedVerse = {
        id: "single",
        book: selectedBook?.name || "",
        chapter: selectedChapter || 0,
        verse: selectedVerse || 0,
        text: currentVerseText,
        reference: currentReference,
        version: selectedVersion,
      }
      setLiveVerses([newVerse])
      updateSlide()
    }
  }

  const isCurrentVerseSelected =
    selectedBook &&
    selectedChapter &&
    selectedVerse &&
    selectedVerses.some((v) => v.id === `${selectedBook.name}-${selectedChapter}-${selectedVerse}`)

  return (
    <div className="h-screen bg-background flex flex-col xl:flex-row overflow-hidden">
      {/* Preview & Live Panels - Shows first on mobile */}
      <div className="flex-1 min-h-0 flex flex-col xl:h-full overflow-hidden order-1 xl:order-2">
        <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
          <h2 className="font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Display
          </h2>
          <div className="flex items-center gap-2">
            {/* Version Selector */}
            <Select value={selectedVersion} onValueChange={setSelectedVersion}>
              <SelectTrigger size="sm" className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BIBLE_VERSIONS.map((v) => (
                  <SelectItem key={v.code} value={v.code}>
                    {v.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Font Size */}
            <div className="flex gap-1">
              {fontSizeOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={fontSize === option.value ? "default" : "outline"}
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setFontSize(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            {/* Theme Toggle */}
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0 bg-transparent"
              onClick={() => {
                const next = !darkMode
                setDarkMode(next)
                setBackgroundColor(next ? "#000000" : "#FFFFFF")
                setBackgroundImage(null)
              }}
              title={darkMode ? "Switch to light" : "Switch to dark"}
            >
              {darkMode ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
            </Button>
            {/* Color Picker */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 bg-transparent"
                onClick={() => setShowColorPicker(!showColorPicker)}
              >
                <div
                  className="h-4 w-4 rounded-sm border border-border"
                  style={{ backgroundColor: backgroundColor }}
                />
              </Button>
              {showColorPicker && (
                <div className="absolute right-0 top-full mt-2 z-50 bg-popover border border-border rounded-lg shadow-lg p-3 w-72">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Background</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={handleResetBackground}
                        title="Reset to default"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Reset
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setShowColorPicker(false)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Current Background Preview */}
                  {backgroundImage && (
                    <div className="mb-3 relative">
                      <div
                        className="w-full h-20 rounded-md border border-border bg-cover bg-center"
                        style={{ backgroundImage: `url(${backgroundImage})` }}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        className="absolute top-1 right-1 h-6 px-2 text-xs"
                        onClick={() => setBackgroundImage(null)}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Remove
                      </Button>
                    </div>
                  )}

                  {/* Color Picker Gradient */}
                  <div className="mb-3">
                    <HexColorPicker
                      color={backgroundColor}
                      onChange={(color) => {
                        setBackgroundColor(color)
                        setBackgroundImage(null)
                      }}
                      style={{ width: "100%", height: "140px" }}
                    />
                  </div>

                  {/* Preset Colors */}
                  <div className="grid grid-cols-5 gap-2 mb-3">
                    {colorPalette.map((color) => (
                      <button
                        key={color.value}
                        className={`h-8 w-8 rounded-md border-2 transition-all ${
                          !backgroundImage && backgroundColor.toUpperCase() === color.value.toUpperCase()
                            ? "border-primary ring-2 ring-primary ring-offset-2"
                            : "border-border hover:border-primary/50"
                        }`}
                        style={{ backgroundColor: color.value }}
                        onClick={() => handleColorSelect(color.value)}
                        title={color.label}
                      >
                        {!backgroundImage && backgroundColor.toUpperCase() === color.value.toUpperCase() && (
                          <Check className={`h-4 w-4 mx-auto ${
                            color.value === "#FFFFFF" ? "text-gray-900" : "text-white"
                          }`} />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Hex Input & Image Upload */}
                  <div className="border-t border-border pt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-8 w-8 rounded-md border border-border shrink-0"
                        style={{ backgroundColor: backgroundColor }}
                      />
                      <Input
                        value={backgroundColor}
                        onChange={(e) => {
                          const val = e.target.value
                          if (/^#([0-9A-Fa-f]{0,6})$/.test(val)) {
                            setBackgroundColor(val)
                            setBackgroundImage(null)
                          }
                        }}
                        className="h-8 text-sm font-mono"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-8 bg-transparent"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImageIcon className="h-3.5 w-3.5 mr-2" />
                      Upload Image
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Preview & Live Panels */}
        <div className="flex-1 min-h-0 p-4 xl:p-6 flex flex-col gap-4 overflow-hidden justify-center items-center">
          {/* Preview Panel */}
          <div className="w-full max-h-[45%] flex flex-col">
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <span className="text-sm font-medium">Preview</span>
              <div className="flex items-center gap-2">
                <div
                  className="flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-background"
                  title="Select text in the preview, then pick a color"
                >
                  <Highlighter className="h-3 w-3 text-muted-foreground" />
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c.swatch}
                      type="button"
                      className="h-4 w-4 rounded-sm border border-border/60 hover:scale-110 transition-transform"
                      style={{ backgroundColor: c.swatch }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyHighlight(c.value)}
                      title={`Highlight ${c.label}`}
                      aria-label={`Highlight ${c.label}`}
                    />
                  ))}
                  <button
                    type="button"
                    className="h-4 w-4 rounded-sm border border-border/60 flex items-center justify-center text-muted-foreground hover:bg-muted"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={clearHighlights}
                    title="Clear all highlights"
                    aria-label="Clear all highlights"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
                <Button
                  size="sm"
                  className="h-7"
                  onClick={goLive}
                  disabled={previewVerses.length === 0 && !currentVerseText}
                >
                  Go Live
                </Button>
              </div>
            </div>
            <Card
              className={`w-full flex-1 aspect-video overflow-hidden transition-colors ${themeLoaded ? (backgroundImage ? "text-white" : getTextColorForBackground(backgroundColor)) : "text-white"}`}
              style={{
                backgroundColor: themeLoaded ? backgroundColor : "#171717",
                backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <CardContent className="h-full flex flex-col justify-center items-center text-center p-4 xl:p-6 max-w-full overflow-auto">
                {loading ? (
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                ) : previewVerses.length > 0 ? (
                  <div className="space-y-4" ref={previewContentRef}>
                    {previewVerses.map((v) => (
                      <div key={v.id} data-verse-id={v.id}>
                        {isNote(v) ? (
                          <>
                            {v.reference && (
                              <p
                                className={`font-bold mb-4 ${
                                  fontSize === "small"
                                    ? "text-sm"
                                    : fontSize === "medium"
                                      ? "text-base"
                                      : fontSize === "large"
                                        ? "text-lg"
                                        : "text-2xl"
                                }`}
                              >
                                {v.reference}
                              </p>
                            )}
                            <div
                              data-verse-text
                              className={`leading-relaxed font-serif prose max-w-none prose-ol:list-inside prose-ul:list-inside prose-ol:pl-0 prose-ul:pl-0 ${backgroundImage || getTextColorForBackground(backgroundColor) === "text-white" ? "prose-invert" : ""} ${
                                fontSize === "small"
                                  ? "prose-sm"
                                  : fontSize === "medium"
                                    ? "prose-base"
                                    : fontSize === "large"
                                      ? "prose-lg"
                                      : "prose-xl"
                              }`}
                            >
                              <ReactMarkdown rehypePlugins={[rehypeRaw]}>{v.text}</ReactMarkdown>
                            </div>
                          </>
                        ) : (
                          <>
                            <p
                              data-verse-text
                              className={`leading-relaxed font-serif ${
                                v.reference ? "text-balance" : "whitespace-pre-wrap"
                              } ${
                                fontSize === "small"
                                  ? "text-sm"
                                  : fontSize === "medium"
                                    ? "text-base"
                                    : fontSize === "large"
                                      ? "text-lg"
                                      : "text-2xl"
                              }`}
                              dangerouslySetInnerHTML={{ __html: v.text }}
                            />
                            {v.reference && (
                              <p
                                className={`mt-4 font-bold italic ${themeLoaded ? (backgroundImage ? "text-gray-300" : getReferenceColorForBackground(backgroundColor)) : "text-gray-400"} ${
                                  fontSize === "small"
                                    ? "text-sm"
                                    : fontSize === "medium"
                                      ? "text-base"
                                      : fontSize === "large"
                                        ? "text-lg"
                                        : "text-xl"
                                }`}
                              >
                                {v.reference} ({v.version || "KJV"})
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ) : currentVerseText ? (
                  <div>
                    <p
                      className={`leading-relaxed font-serif ${
                        currentReference ? "text-balance" : "whitespace-pre-wrap"
                      } ${
                        fontSize === "small"
                          ? "text-sm"
                          : fontSize === "medium"
                            ? "text-base"
                            : fontSize === "large"
                              ? "text-lg"
                              : "text-2xl"
                      }`}
                      dangerouslySetInnerHTML={{ __html: currentVerseText }}
                    />
                    {currentReference && (
                      <p
                        className={`mt-4 font-bold italic ${themeLoaded ? (backgroundImage ? "text-gray-300" : getReferenceColorForBackground(backgroundColor)) : "text-gray-400"} ${
                          fontSize === "small"
                            ? "text-sm"
                            : fontSize === "medium"
                              ? "text-base"
                              : fontSize === "large"
                                ? "text-lg"
                                : "text-xl"
                        }`}
                      >
                        {currentReference} ({selectedVersion})
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Select a verse to preview</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Live Panel */}
          <div className="w-full max-h-[45%] flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-2">
                {liveVerses.length > 0 && <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
                Live
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 bg-transparent"
                  onClick={clearDisplay}
                  disabled={liveVerses.length === 0}
                  title="Clear display"
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Clear
                </Button>
                <Button size="sm" variant="outline" className="h-7 bg-transparent" onClick={openSlideshowWindow}>
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Window
                </Button>
              </div>
            </div>
            <Card
              className={`w-full flex-1 aspect-video border-2 border-red-500 overflow-hidden transition-colors ${themeLoaded ? (backgroundImage ? "text-white" : getTextColorForBackground(backgroundColor)) : "text-white"}`}
              style={{
                backgroundColor: themeLoaded ? backgroundColor : "#171717",
                backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <CardContent className="h-full flex flex-col justify-center items-center text-center p-4 xl:p-6 max-w-full overflow-auto">
                {liveVerses.length > 0 ? (
                  <div className="space-y-4">
                    {liveVerses.map((v) => (
                      <div key={v.id}>
                        {isNote(v) ? (
                          <>
                            {v.reference && (
                              <p
                                className={`font-bold mb-4 ${
                                  fontSize === "small"
                                    ? "text-sm"
                                    : fontSize === "medium"
                                      ? "text-base"
                                      : fontSize === "large"
                                        ? "text-lg"
                                        : "text-2xl"
                                }`}
                              >
                                {v.reference}
                              </p>
                            )}
                            <div
                              className={`leading-relaxed font-serif prose max-w-none prose-ol:list-inside prose-ul:list-inside prose-ol:pl-0 prose-ul:pl-0 ${backgroundImage || getTextColorForBackground(backgroundColor) === "text-white" ? "prose-invert" : ""} ${
                                fontSize === "small"
                                  ? "prose-sm"
                                  : fontSize === "medium"
                                    ? "prose-base"
                                    : fontSize === "large"
                                      ? "prose-lg"
                                      : "prose-xl"
                              }`}
                            >
                              <ReactMarkdown rehypePlugins={[rehypeRaw]}>{v.text}</ReactMarkdown>
                            </div>
                          </>
                        ) : (
                          <>
                            <p
                              className={`leading-relaxed font-serif ${
                                v.reference ? "text-balance" : "whitespace-pre-wrap"
                              } ${
                                fontSize === "small"
                                  ? "text-sm"
                                  : fontSize === "medium"
                                    ? "text-base"
                                    : fontSize === "large"
                                      ? "text-lg"
                                      : "text-2xl"
                              }`}
                              dangerouslySetInnerHTML={{ __html: v.text }}
                            />
                            {v.reference && (
                              <p
                                className={`mt-4 font-bold italic ${themeLoaded ? (backgroundImage ? "text-gray-300" : getReferenceColorForBackground(backgroundColor)) : "text-gray-400"} ${
                                  fontSize === "small"
                                    ? "text-sm"
                                    : fontSize === "medium"
                                      ? "text-base"
                                      : fontSize === "large"
                                        ? "text-lg"
                                        : "text-xl"
                                }`}
                              >
                                {v.reference} ({v.version || "KJV"})
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Nothing is live</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Queue Display */}
        <div className="px-4 xl:px-6 pb-4">
          {selectedVerses.length > 0 && (
            <div className="flex flex-wrap gap-2 max-w-4xl mx-auto w-full">
              {selectedVerses.map((v) => (
                <span key={v.id} className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-md text-xs">
                  {v.reference || "Note"}
                  <button
                    onClick={() => setSelectedVerses((prev) => prev.filter((pv) => pv.id !== v.id))}
                    className="hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bible Selector - Shows second on mobile */}
      <div className="h-[50vh] xl:h-full min-h-0 flex border-t xl:border-t-0 xl:border-r border-border order-2 xl:order-1 overflow-hidden">
        {/* Sidebar with Tabs */}
        <div className="w-48 xl:w-64 border-r border-border flex flex-col h-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            <div className="p-2 border-b border-border shrink-0">
              <TabsList className="w-full grid grid-cols-3 h-10">
                <TabsTrigger value="bible" className="text-xs px-2 gap-1">
                  <Book className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">Bible</span>
                </TabsTrigger>
                <TabsTrigger value="notes" className="text-xs px-2 gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">Notes</span>
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs px-2 gap-1">
                  <History className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">History</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Bible Books Tab */}
            <TabsContent value="bible" className="flex-1 m-0 min-h-0 flex flex-col">
              <div className="p-2 border-b border-border">
                <Input
                  placeholder="Search books..."
                  value={bookSearch}
                  onChange={(e) => setBookSearch(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-2">
                  {filteredOldTestament.length > 0 && (
                    <>
                      <p className="text-xs font-medium text-muted-foreground px-2 py-1">Old Testament</p>
                      {filteredOldTestament.map((book) => (
                        <button
                          key={book.name}
                          onClick={() => handleBookSelect(book)}
                          className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                            selectedBook?.name === book.name ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                          }`}
                        >
                          {book.name}
                        </button>
                      ))}
                    </>
                  )}
                  {filteredNewTestament.length > 0 && (
                    <>
                      <p className={`text-xs font-medium text-muted-foreground px-2 py-1 ${filteredOldTestament.length > 0 ? "mt-4" : ""}`}>New Testament</p>
                      {filteredNewTestament.map((book) => (
                        <button
                          key={book.name}
                          onClick={() => handleBookSelect(book)}
                          className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                            selectedBook?.name === book.name ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                          }`}
                        >
                          {book.name}
                        </button>
                      ))}
                    </>
                  )}
                  {filteredOldTestament.length === 0 && filteredNewTestament.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No books found</p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="flex-1 m-0 min-h-0 flex flex-col p-4">
              <div className="space-y-4 flex flex-col h-full">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Title (optional)</label>
                  <Input
                    placeholder="e.g., Sermon Point 1"
                    value={customNoteTitle}
                    onChange={(e) => setCustomNoteTitle(e.target.value)}
                  />
                </div>
                <div className="flex-1 flex flex-col min-h-0">
                  <label className="text-sm font-medium mb-1.5 block">Note Text</label>
                  <div className="flex gap-1 mb-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0 bg-transparent"
                      onClick={() => insertFormatting("**")}
                      title="Bold"
                    >
                      <Bold className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0 bg-transparent"
                      onClick={() => insertFormatting("*")}
                      title="Italic"
                    >
                      <Italic className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0 bg-transparent"
                      onClick={() => insertFormatting("<u>", "</u>")}
                      title="Underline"
                    >
                      <Underline className="h-3.5 w-3.5" />
                    </Button>
                    <div className="w-px bg-border mx-1" />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0 bg-transparent"
                      onClick={() => insertFormatting("1. ", "")}
                      title="Numbered List"
                    >
                      <ListOrdered className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0 bg-transparent"
                      onClick={() => insertFormatting("- ", "")}
                      title="Bullet List"
                    >
                      <List className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Textarea
                    ref={noteTextareaRef}
                    placeholder="Type your custom text here..."
                    value={customNoteText}
                    onChange={(e) => setCustomNoteText(e.target.value)}
                    className="flex-1 resize-none min-h-24"
                  />
                </div>
                <div className="space-y-2">
                  <Button
                    onClick={previewNote}
                    variant="outline"
                    className="w-full gap-2 bg-transparent"
                    disabled={!customNoteText.trim() && !customNoteTitle.trim()}
                  >
                    <BookOpen className="h-4 w-4" />
                    Preview Note
                  </Button>
                  <Button onClick={projectCustomNote} className="w-full gap-2" disabled={!customNoteText.trim() && !customNoteTitle.trim()}>
                    <ExternalLink className="h-4 w-4" />
                    Project Note
                  </Button>
                  <Button
                    onClick={addCustomNoteToQueue}
                    variant="outline"
                    className="w-full gap-2 bg-transparent"
                    disabled={!customNoteText.trim() && !customNoteTitle.trim()}
                  >
                    <Plus className="h-4 w-4" />
                    Add to Queue
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="flex-1 m-0 min-h-0 flex flex-col">
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-2 space-y-1">
                  {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No history yet</p>
                  ) : (
                    history.map((item, index) => (
                      <button
                        key={index}
                        onClick={() => projectFromHistory(item)}
                        className="w-full text-left p-2 rounded-md hover:bg-muted transition-colors"
                      >
                        <p className="font-medium text-sm truncate">{item.reference || "Note"}</p>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">{item.text}</p>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
              {history.length > 0 && (
                <div className="p-2 border-t border-border">
                  <Button onClick={clearHistory} variant="ghost" size="sm" className="w-full text-muted-foreground">
                    <X className="h-4 w-4 mr-2" />
                    Clear History
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {activeTab === "bible" && selectedBook && (
          <div className="w-28 xl:w-36 border-r border-border flex flex-col h-full">
            <div className="p-2 xl:p-4 border-b border-border shrink-0">
              <h2 className="font-semibold text-xs xl:text-sm">Chapters</h2>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-2">
                {selectedBook?.chapters.map((_, index) => (
                  <button
                    key={index + 1}
                    onClick={() => handleChapterSelect(index + 1)}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                      selectedChapter === index + 1 ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    Chapter {index + 1}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {activeTab === "bible" && selectedBook && selectedChapter && (
          <div className="w-28 xl:w-36 border-r border-border flex flex-col h-full">
            <div className="p-2 xl:p-4 border-b border-border shrink-0">
              <h2 className="font-semibold text-xs xl:text-sm">Verses</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">Shift+click for range</p>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-2">
                {Array.from({ length: selectedBook.chapters[selectedChapter - 1] }, (_, i) => i + 1).map((verse) => {
                  const isInRange = rangeStartVerse !== null && rangeEndVerse !== null &&
                    verse >= rangeStartVerse && verse <= rangeEndVerse
                  const isRangeStart = verse === rangeStartVerse && rangeEndVerse === null
                  const isSelected = selectedVerse === verse

                  return (
                    <button
                      key={verse}
                      onClick={(e) => handleVerseSelect(verse, e)}
                      onDoubleClick={() => handleVerseDoubleClick(verse)}
                      className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                        isInRange
                          ? "bg-primary text-primary-foreground"
                          : isRangeStart || isSelected
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                      }`}
                    >
                      Verse {verse}
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  )
}
