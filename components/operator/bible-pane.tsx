"use client"

import { useState } from "react"
import {
  getPrevChapterRef,
  getNextChapterRef,
  type BibleBook,
  type BibleRef,
} from "@/lib/bible-data"
import { BibleSearchBox } from "./bible-search-box"
import { BibleToolbar, type BiblePaneView } from "./bible-toolbar"
import { BookGrid } from "./book-grid"
import { ChapterGrid } from "./chapter-grid"
import { ChapterReader, type ChapterVerse } from "./chapter-reader"
import { ScriptureSearchResults } from "./scripture-search-results"
import type { ScriptureSearchResult } from "@/lib/scripture-search"

interface BiblePaneProps {
  selectedBook: BibleBook | null
  selectedChapter: number | null
  selectedVerse: number | null
  rangeStartVerse: number | null
  rangeEndVerse: number | null
  version: string
  chapterVerses: ChapterVerse[]
  chapterLoading: boolean
  chapterError: string | null
  onVersionChange: (v: string) => void
  onReferenceChange: (book: BibleBook | null, chapter: number | null, verse?: number) => void
  onJumpSelect: (book: BibleBook, chapter: number, verse: number) => void
  onJumpProject: (book: BibleBook, chapter: number, verse: number) => void
  onSelectVerse: (verse: number, shiftKey: boolean) => void
  onDoubleClickVerse: (verse: number) => void
  onQueueVerse: (verse: number) => void
  onPreviewSearchResult: (result: ScriptureSearchResult) => void
  onProjectSearchResult: (result: ScriptureSearchResult) => void
  onQueueSearchResult: (result: ScriptureSearchResult) => void
}

export function BiblePane({
  selectedBook,
  selectedChapter,
  selectedVerse,
  rangeStartVerse,
  rangeEndVerse,
  version,
  chapterVerses,
  chapterLoading,
  chapterError,
  onVersionChange,
  onReferenceChange,
  onJumpSelect,
  onJumpProject,
  onSelectVerse,
  onDoubleClickVerse,
  onQueueVerse,
  onPreviewSearchResult,
  onProjectSearchResult,
  onQueueSearchResult,
}: BiblePaneProps) {
  const [bookQuery, setBookQuery] = useState("")
  const searchActive = bookQuery.trim().length >= 2

  // View state machine:
  // - no book → books grid
  // - book but no chapter → chapter grid
  // - book + chapter → reader
  const view: BiblePaneView =
    !selectedBook ? "books" : !selectedChapter ? "chapters" : "reader"

  const handleBackToBooks = () => onReferenceChange(null, null)
  const handleBackToChapters = () => {
    if (selectedBook) onReferenceChange(selectedBook, null)
  }

  return (
    <div className="h-full flex flex-col">
      <BibleToolbar
        book={selectedBook}
        chapter={selectedChapter}
        view={view}
        version={version}
        onVersionChange={onVersionChange}
        onHome={handleBackToBooks}
        onBookCrumb={handleBackToChapters}
        onChapterJump={(chapter) => selectedBook && onReferenceChange(selectedBook, chapter)}
        onJumpSelect={onJumpSelect}
        onJumpProject={onJumpProject}
        onNavigate={(book, chapter) => onReferenceChange(book, chapter)}
      />

      {/* Books view — search the whole Bible, or browse books when empty */}
      {view === "books" && (
        <>
          <BibleSearchBox query={bookQuery} onQueryChange={setBookQuery} />
          {searchActive ? (
            <ScriptureSearchResults
              query={bookQuery}
              version={version}
              onPreview={onPreviewSearchResult}
              onProject={onProjectSearchResult}
              onQueue={onQueueSearchResult}
            />
          ) : (
            <BookGrid
              selectedBook={selectedBook}
              query={bookQuery}
              onSelect={(b) => onReferenceChange(b, null)}
            />
          )}
        </>
      )}

      {view === "chapters" && selectedBook && (
        <ChapterGrid
          book={selectedBook}
          selected={selectedChapter}
          onSelect={(ch) => onReferenceChange(selectedBook, ch)}
        />
      )}

      {view === "reader" && (
        <ChapterReader
          book={selectedBook}
          chapter={selectedChapter}
          verses={chapterVerses}
          loading={chapterLoading}
          error={chapterError}
          version={version}
          selectedVerse={selectedVerse}
          rangeStart={rangeStartVerse}
          rangeEnd={rangeEndVerse}
          prevRef={
            selectedBook && selectedChapter
              ? getPrevChapterRef(selectedBook, selectedChapter)
              : null
          }
          nextRef={
            selectedBook && selectedChapter
              ? getNextChapterRef(selectedBook, selectedChapter)
              : null
          }
          onNavigate={(ref: BibleRef) => onReferenceChange(ref.book, ref.chapter)}
          onSelectVerse={onSelectVerse}
          onDoubleClickVerse={onDoubleClickVerse}
          onQueueVerse={onQueueVerse}
        />
      )}
    </div>
  )
}
