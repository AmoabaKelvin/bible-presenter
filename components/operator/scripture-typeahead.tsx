"use client"

import { Search, X } from "lucide-react"
import type { BibleBook } from "@/lib/bible-data"
import { useScriptureTypeahead } from "@/hooks/use-scripture-typeahead"
import {
  ScriptureBookDropdown,
  ScriptureTypeaheadChip,
} from "./scripture-typeahead-ui"

export interface ScriptureTypeaheadProps {
  /** Project a verse straight to live (Enter). */
  onProject: (book: BibleBook, chapter: number, verse: number) => void
  /** Live preview as the verse is typed — navigate to it, highlight it, and
   *  scroll it into view, exactly like a single click on it in the reader. */
  onSelect: (book: BibleBook, chapter: number, verse: number) => void
  /** Fired when only book + chapter are committed (no verse). Used for navigation parity with the previous parser. */
  onNavigate?: (book: BibleBook, chapter: number) => void
}

export const SCRIPTURE_TYPEAHEAD_INPUT_ID = "scripture-typeahead-input"

export function ScriptureTypeahead({
  onProject,
  onSelect,
  onNavigate,
}: ScriptureTypeaheadProps) {
  const {
    stage,
    book,
    chapter,
    matches,
    activeIndex,
    error,
    inputRef,
    inputValue,
    placeholder,
    showDropdown,
    bookQuery,
    setActiveIndex,
    commitBookByIndex,
    clearChapter,
    reset,
    onChange,
    onKeyDown,
  } = useScriptureTypeahead({ onProject, onSelect, onNavigate })

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
          <ScriptureTypeaheadChip
            label={book.name}
            onRemove={() => {
              reset()
              inputRef.current?.focus()
            }}
          />
        )}
        {chapter !== null && (
          <ScriptureTypeaheadChip
            label={String(chapter)}
            mono
            onRemove={clearChapter}
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
        <ScriptureBookDropdown
          matches={matches}
          activeIndex={activeIndex}
          bookQuery={bookQuery}
          inputRef={inputRef}
          onActiveIndexChange={setActiveIndex}
          onCommit={commitBookByIndex}
        />
      )}
    </div>
  )
}
