"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { Search, X } from "lucide-react"
import { allBooks, type BibleBook } from "@/lib/bible-data"

type Stage = "book" | "chapter" | "verse"

export interface ScriptureTypeaheadProps {
  /** Project a verse straight to live (Enter). */
  onProject: (book: BibleBook, chapter: number, verse: number) => void
  /** Live preview as the verse is typed — navigate to it, highlight it, and
   *  scroll it into view, exactly like a single click on it in the reader. */
  onSelect: (book: BibleBook, chapter: number, verse: number) => void
  /** Fired when only book + chapter are committed (no verse). Used for navigation parity with the previous parser. */
  onNavigate?: (book: BibleBook, chapter: number) => void
}

/** Sort matches: startsWith first, then contains; alphabetical within each group. */
function matchBooks(query: string): BibleBook[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const starts: BibleBook[] = []
  const contains: BibleBook[] = []
  for (const b of allBooks) {
    const name = b.name.toLowerCase()
    if (name.startsWith(q)) starts.push(b)
    else if (name.includes(q)) contains.push(b)
  }
  const byName = (a: BibleBook, b: BibleBook) => a.name.localeCompare(b.name)
  starts.sort(byName)
  contains.sort(byName)
  return [...starts, ...contains]
}

/** Try to parse a full reference like "John 3:16" or "1 John 2:5" or "Gen 1". */
function parseFullReference(
  raw: string,
): { book: BibleBook; chapter: number; verse?: number } | null {
  const trimmed = raw.trim()
  const m = trimmed.match(/^([1-3]?\s?[A-Za-z .]+?)\s+(\d+)(?::(\d+))?$/)
  if (!m) return null
  const bookGuess = m[1].trim().toLowerCase()
  const chRequested = Number(m[2])
  const vRequested = m[3] ? Number(m[3]) : undefined
  const book =
    allBooks.find((b) => b.name.toLowerCase() === bookGuess) ||
    allBooks.find((b) => b.name.toLowerCase().startsWith(bookGuess))
  if (!book) return null
  const ch = Math.min(Math.max(chRequested, 1), book.chapters.length)
  const verseCount = book.chapters[ch - 1]
  const verse =
    vRequested !== undefined
      ? Math.min(Math.max(vRequested, 1), verseCount)
      : undefined
  return { book, chapter: ch, verse }
}

export const SCRIPTURE_TYPEAHEAD_INPUT_ID = "scripture-typeahead-input"

export function ScriptureTypeahead({
  onProject,
  onSelect,
  onNavigate,
}: ScriptureTypeaheadProps) {
  const [stage, setStage] = useState<Stage>("book")
  const [book, setBook] = useState<BibleBook | null>(null)
  const [chapter, setChapter] = useState<number | null>(null)
  const [bookQuery, setBookQuery] = useState("")
  const [chapterInput, setChapterInput] = useState("")
  const [verseInput, setVerseInput] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [error, setError] = useState(false)
  // Remember the typed text per stage so backspace-to-previous can restore it.
  const lastBookQueryRef = useRef("")
  const lastChapterInputRef = useRef("")
  const inputRef = useRef<HTMLInputElement>(null)
  // Suppress the next auto-confirm — used when restoring text via un-confirm,
  // otherwise a single-match query would immediately re-lock the book.
  const suppressAutoConfirmRef = useRef(false)

  const matches = useMemo(
    () => (stage === "book" ? matchBooks(bookQuery) : []),
    [stage, bookQuery],
  )

  // Keep the active highlight in range as the match list changes.
  useEffect(() => {
    if (matches.length === 0) {
      setActiveIndex(0)
    } else if (activeIndex >= matches.length) {
      setActiveIndex(0)
    }
  }, [matches, activeIndex])

  // Auto-confirm when exactly one book matches.
  useEffect(() => {
    if (stage !== "book") return
    if (suppressAutoConfirmRef.current) {
      suppressAutoConfirmRef.current = false
      return
    }
    if (matches.length !== 1) return
    if (!bookQuery.trim()) return
    const only = matches[0]
    lastBookQueryRef.current = bookQuery
    setBook(only)
    setBookQuery("")
    setStage("chapter")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, stage])

  const reset = useCallback(() => {
    setStage("book")
    setBook(null)
    setChapter(null)
    setBookQuery("")
    setChapterInput("")
    setVerseInput("")
    setActiveIndex(0)
    setError(false)
    lastBookQueryRef.current = ""
    lastChapterInputRef.current = ""
  }, [])

  // After a jump, keep the book + chapter chips so the next verse in the same
  // passage is one keystroke away; clear only the verse field and keep focus.
  const retainAfterProject = useCallback((b: BibleBook, ch: number) => {
    setBook(b)
    setChapter(ch)
    setBookQuery("")
    setChapterInput("")
    setVerseInput("")
    setStage("verse")
    setActiveIndex(0)
    setError(false)
    lastChapterInputRef.current = String(ch)
    inputRef.current?.focus()
  }, [])

  // Global "/" focuses the input — unless focus is already in an editable element.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/") return
      const t = e.target as HTMLElement | null
      const editable =
        t && (/^(INPUT|TEXTAREA)$/.test(t.tagName) || t.isContentEditable)
      if (editable) return
      e.preventDefault()
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const commitBookByIndex = (idx: number) => {
    const target = matches[idx]
    if (!target) return false
    lastBookQueryRef.current = bookQuery
    setBook(target)
    setBookQuery("")
    setStage("chapter")
    setError(false)
    return true
  }

  const commitChapter = () => {
    if (!book) return false
    const n = Number(chapterInput)
    if (!chapterInput || !Number.isFinite(n) || n < 1) return false
    const clamped = Math.min(Math.max(n, 1), book.chapters.length)
    lastChapterInputRef.current = chapterInput
    setChapter(clamped)
    setChapterInput("")
    setStage("verse")
    setError(false)
    onNavigate?.(book, clamped)
    return true
  }

  const unconfirmBook = () => {
    if (!book) return
    suppressAutoConfirmRef.current = true
    setStage("book")
    setBookQuery(lastBookQueryRef.current)
    setBook(null)
    setChapter(null)
    setError(false)
  }

  const unconfirmChapter = () => {
    if (!book || !chapter) return
    setStage("chapter")
    setChapterInput(lastChapterInputRef.current)
    setChapter(null)
    setError(false)
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setError(false)
    if (stage === "book") {
      setBookQuery(value)
    } else if (stage === "chapter") {
      // Digits only.
      setChapterInput(value.replace(/\D/g, ""))
    } else {
      const digits = value.replace(/\D/g, "")
      setVerseInput(digits)
      // Live-preview the typed verse: highlight it and scroll it into view,
      // exactly like a single click. Enter still projects it to live.
      if (book && chapter && digits) {
        const n = Number(digits)
        const verseCount = book.chapters[chapter - 1]
        const clamped = Math.min(Math.max(n, 1), verseCount)
        onSelect(book, chapter, clamped)
      }
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Escape always clears state and blurs.
    if (e.key === "Escape") {
      e.preventDefault()
      reset()
      inputRef.current?.blur()
      return
    }

    if (stage === "book") {
      if (e.key === "ArrowDown") {
        if (matches.length === 0) return
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % matches.length)
        return
      }
      if (e.key === "ArrowUp") {
        if (matches.length === 0) return
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + matches.length) % matches.length)
        return
      }
      if (e.key === " " || e.code === "Space") {
        // If the typed text + " " is the prefix of any book name (e.g. "1 " for
        // "1 John"), let the space through so the user can keep typing.
        const withSpace = bookQuery + " "
        const prefixMatch = allBooks.some((b) =>
          b.name.toLowerCase().startsWith(withSpace.toLowerCase()),
        )
        if (prefixMatch) return
        // Otherwise space confirms the highlighted match.
        if (matches.length === 0) return
        e.preventDefault()
        commitBookByIndex(activeIndex)
        return
      }
      if (e.key === "Enter") {
        e.preventDefault()
        // Full-reference fallback if the user typed something parser-shaped.
        const parsed = parseFullReference(bookQuery)
        if (parsed) {
          if (parsed.verse !== undefined) {
            onProject(parsed.book, parsed.chapter, parsed.verse)
            retainAfterProject(parsed.book, parsed.chapter)
          } else {
            // "John 3" with no verse — do nothing per spec.
            setError(true)
          }
          return
        }
        // Otherwise confirm the highlighted match.
        if (matches.length > 0) commitBookByIndex(activeIndex)
        else setError(true)
        return
      }
      return
    }

    if (stage === "chapter") {
      if (e.key === "Backspace" && chapterInput.length === 0) {
        e.preventDefault()
        unconfirmBook()
        return
      }
      if (e.key === " " || e.code === "Space" || e.key === ":") {
        // Colon also acts as a chapter→verse separator so a user typing
        // "3:16" after the book chip ends up with the right split.
        e.preventDefault()
        commitChapter()
        return
      }
      if (e.key === "Enter") {
        // Enter without a verse does nothing — per spec.
        e.preventDefault()
        return
      }
      return
    }

    if (stage === "verse") {
      if (e.key === "Backspace" && verseInput.length === 0) {
        e.preventDefault()
        unconfirmChapter()
        return
      }
      if (e.key === "Enter") {
        e.preventDefault()
        if (!book || !chapter) return
        const n = Number(verseInput)
        if (!verseInput || !Number.isFinite(n) || n < 1) {
          setError(true)
          return
        }
        const verseCount = book.chapters[chapter - 1]
        const clamped = Math.min(Math.max(n, 1), verseCount)
        onProject(book, chapter, clamped)
        retainAfterProject(book, chapter)
        return
      }
      return
    }
  }

  const placeholder =
    stage === "book"
      ? "Jump — type a book"
      : stage === "chapter"
        ? "Chapter"
        : "Verse"

  const showDropdown = stage === "book" && matches.length > 0 && bookQuery.trim().length > 0

  const inputValue =
    stage === "book"
      ? bookQuery
      : stage === "chapter"
        ? chapterInput
        : verseInput

  return (
    <div className="relative">
      <div
        className={`flex items-center h-9 rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] w-[280px] pl-2 pr-1 gap-1.5 focus-within:ring-[3px] ${
          error
            ? "border-destructive focus-within:ring-destructive/30 focus-within:border-destructive"
            : "border-input focus-within:ring-ring/50 focus-within:border-ring"
        }`}
      >
        <Search
          className={`size-3.5 shrink-0 ${
            error ? "text-destructive" : "text-muted-foreground"
          }`}
        />
        {book && (
          <Chip
            label={book.name}
            onRemove={() => {
              // Clicking the chip's × clears everything and returns to book stage.
              reset()
              inputRef.current?.focus()
            }}
          />
        )}
        {chapter !== null && (
          <Chip
            label={String(chapter)}
            mono
            onRemove={() => {
              if (!book) return
              setStage("chapter")
              setChapter(null)
              setChapterInput("")
              inputRef.current?.focus()
            }}
          />
        )}
        <input
          ref={inputRef}
          id={SCRIPTURE_TYPEAHEAD_INPUT_ID}
          value={inputValue}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          inputMode={stage === "book" ? "text" : "numeric"}
          autoComplete="off"
          spellCheck={false}
          className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          aria-label="Jump to passage"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls="scripture-typeahead-listbox"
        />
        {(book || chapter !== null || inputValue) && (
          <button
            type="button"
            onClick={() => {
              reset()
              inputRef.current?.focus()
            }}
            className="size-6 grid place-items-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent shrink-0"
            aria-label="Clear"
            tabIndex={-1}
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          id="scripture-typeahead-listbox"
          role="listbox"
          className="absolute z-50 right-0 mt-1 w-[280px] max-h-72 overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md scroll-thin"
        >
          {matches.map((m, i) => {
            const active = i === activeIndex
            return (
              <button
                key={m.name}
                type="button"
                role="option"
                aria-selected={active}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => {
                  // Use mousedown so we commit before the input blurs.
                  e.preventDefault()
                  commitBookByIndex(i)
                  inputRef.current?.focus()
                }}
                className={`w-full text-left px-2.5 py-1.5 text-sm flex items-center justify-between gap-2 ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/60"
                }`}
              >
                <span className="truncate">
                  {renderHighlightedName(m.name, bookQuery)}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground tabular-nums shrink-0">
                  {m.chapters.length} ch
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Chip({
  label,
  mono,
  onRemove,
}: {
  label: string
  mono?: boolean
  onRemove: () => void
}) {
  return (
    <span
      className={`h-6 inline-flex items-center gap-1 pl-1.5 pr-1 rounded-sm border border-border bg-accent/60 text-foreground text-[12px] shrink-0 ${
        mono ? "font-mono tabular-nums" : "font-medium"
      }`}
    >
      <span className="leading-none">{label}</span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          onRemove()
        }}
        className="size-4 grid place-items-center rounded-[2px] text-muted-foreground hover:text-foreground hover:bg-background/60"
        aria-label={`Remove ${label}`}
        tabIndex={-1}
      >
        <X className="size-2.5" />
      </button>
    </span>
  )
}

/** Bold-style the matching substring in a book name. Case-insensitive match. */
function renderHighlightedName(name: string, query: string) {
  const q = query.trim()
  if (!q) return name
  const idx = name.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return name
  return (
    <>
      {name.slice(0, idx)}
      <span className="font-semibold text-foreground">
        {name.slice(idx, idx + q.length)}
      </span>
      {name.slice(idx + q.length)}
    </>
  )
}
