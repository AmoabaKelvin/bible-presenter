"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react"
import type { BibleBook } from "@/lib/bible-data"
import {
  allowsScriptureBookSpace,
  matchScriptureBooks,
  parseFullScriptureReference,
} from "@/lib/scripture-reference"

export type ScriptureTypeaheadStage = "book" | "chapter" | "verse"

type UseScriptureTypeaheadOptions = {
  onProject: (book: BibleBook, chapter: number, verse: number) => void
  onSelect: (book: BibleBook, chapter: number, verse: number) => void
  onNavigate?: (book: BibleBook, chapter: number) => void
}

export function useScriptureTypeahead({
  onProject,
  onSelect,
  onNavigate,
}: UseScriptureTypeaheadOptions) {
  const [stage, setStage] = useState<ScriptureTypeaheadStage>("book")
  const [book, setBook] = useState<BibleBook | null>(null)
  const [chapter, setChapter] = useState<number | null>(null)
  const [bookQuery, setBookQuery] = useState("")
  const [chapterInput, setChapterInput] = useState("")
  const [verseInput, setVerseInput] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [error, setError] = useState(false)
  const lastBookQueryRef = useRef("")
  const lastChapterInputRef = useRef("")
  const inputRef = useRef<HTMLInputElement>(null)
  const suppressAutoConfirmRef = useRef(false)

  const matches = useMemo(
    () => (stage === "book" ? matchScriptureBooks(bookQuery) : []),
    [stage, bookQuery],
  )

  useEffect(() => {
    if (matches.length === 0) setActiveIndex(0)
    else if (activeIndex >= matches.length) setActiveIndex(0)
  }, [matches, activeIndex])

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
  }, [bookQuery, matches, stage])

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

  const retainAfterProject = useCallback((targetBook: BibleBook, targetChapter: number) => {
    setBook(targetBook)
    setChapter(targetChapter)
    setBookQuery("")
    setChapterInput("")
    setVerseInput("")
    setStage("verse")
    setActiveIndex(0)
    setError(false)
    lastChapterInputRef.current = String(targetChapter)
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "/") return
      const target = event.target as HTMLElement | null
      const editable =
        target && (/^(INPUT|TEXTAREA)$/.test(target.tagName) || target.isContentEditable)
      if (editable) return
      event.preventDefault()
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const commitBookByIndex = useCallback(
    (idx: number) => {
      const target = matches[idx]
      if (!target) return false
      lastBookQueryRef.current = bookQuery
      setBook(target)
      setBookQuery("")
      setStage("chapter")
      setError(false)
      return true
    },
    [bookQuery, matches],
  )

  const commitChapter = useCallback(() => {
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
  }, [book, chapterInput, onNavigate])

  const unconfirmBook = useCallback(() => {
    if (!book) return
    suppressAutoConfirmRef.current = true
    setStage("book")
    setBookQuery(lastBookQueryRef.current)
    setBook(null)
    setChapter(null)
    setError(false)
  }, [book])

  const unconfirmChapter = useCallback(() => {
    if (!book || !chapter) return
    setStage("chapter")
    setChapterInput(lastChapterInputRef.current)
    setChapter(null)
    setError(false)
  }, [book, chapter])

  const clearChapter = useCallback(() => {
    if (!book) return
    setStage("chapter")
    setChapter(null)
    setChapterInput("")
    inputRef.current?.focus()
  }, [book])

  const onChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value
      setError(false)
      if (stage === "book") {
        setBookQuery(value)
      } else if (stage === "chapter") {
        setChapterInput(value.replace(/\D/g, ""))
      } else {
        const digits = value.replace(/\D/g, "")
        setVerseInput(digits)
        if (book && chapter && digits) {
          const n = Number(digits)
          const verseCount = book.chapters[chapter - 1]
          const clamped = Math.min(Math.max(n, 1), verseCount)
          onSelect(book, chapter, clamped)
        }
      }
    },
    [book, chapter, onSelect, stage],
  )

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault()
        reset()
        inputRef.current?.blur()
        return
      }

      if (stage === "book") {
        if (event.key === "ArrowDown") {
          if (matches.length === 0) return
          event.preventDefault()
          setActiveIndex((index) => (index + 1) % matches.length)
          return
        }
        if (event.key === "ArrowUp") {
          if (matches.length === 0) return
          event.preventDefault()
          setActiveIndex((index) => (index - 1 + matches.length) % matches.length)
          return
        }
        if (event.key === " " || event.code === "Space") {
          if (allowsScriptureBookSpace(bookQuery)) return
          if (matches.length === 0) return
          event.preventDefault()
          commitBookByIndex(activeIndex)
          return
        }
        if (event.key === "Enter") {
          event.preventDefault()
          const parsed = parseFullScriptureReference(bookQuery)
          if (parsed) {
            if (parsed.verse !== undefined) {
              onProject(parsed.book, parsed.chapter, parsed.verse)
              retainAfterProject(parsed.book, parsed.chapter)
            } else {
              setError(true)
            }
            return
          }
          if (matches.length > 0) commitBookByIndex(activeIndex)
          else setError(true)
        }
        return
      }

      if (stage === "chapter") {
        if (event.key === "Backspace" && chapterInput.length === 0) {
          event.preventDefault()
          unconfirmBook()
          return
        }
        if (event.key === " " || event.code === "Space" || event.key === ":") {
          event.preventDefault()
          commitChapter()
          return
        }
        if (event.key === "Enter") event.preventDefault()
        return
      }

      if (stage === "verse") {
        if (event.key === "Backspace" && verseInput.length === 0) {
          event.preventDefault()
          unconfirmChapter()
          return
        }
        if (event.key === "Enter") {
          event.preventDefault()
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
        }
      }
    },
    [
      activeIndex,
      book,
      bookQuery,
      chapter,
      chapterInput,
      commitBookByIndex,
      commitChapter,
      matches.length,
      onProject,
      reset,
      retainAfterProject,
      stage,
      unconfirmBook,
      unconfirmChapter,
      verseInput,
    ],
  )

  const placeholder =
    stage === "book" ? "Jump — type a book" : stage === "chapter" ? "Chapter" : "Verse"
  const inputValue =
    stage === "book" ? bookQuery : stage === "chapter" ? chapterInput : verseInput

  return {
    stage,
    book,
    chapter,
    matches,
    activeIndex,
    error,
    inputRef,
    inputValue,
    placeholder,
    showDropdown: stage === "book" && matches.length > 0 && bookQuery.trim().length > 0,
    bookQuery,
    setActiveIndex,
    commitBookByIndex,
    clearChapter,
    reset,
    onChange,
    onKeyDown,
  }
}
