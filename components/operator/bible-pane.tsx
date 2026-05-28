"use client"

import { useState } from "react"
import { ChevronRight, Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  BIBLE_VERSIONS,
  getPrevChapterRef,
  getNextChapterRef,
  type BibleBook,
  type BibleRef,
} from "@/lib/bible-data"
import { BookGrid } from "./book-grid"
import { ChapterGrid } from "./chapter-grid"
import { ChapterReader, type ChapterVerse } from "./chapter-reader"
import { ScriptureTypeahead } from "./scripture-typeahead"

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
  onJumpProject: (book: BibleBook, chapter: number, verse: number) => void
  onSelectVerse: (verse: number, shiftKey: boolean) => void
  onDoubleClickVerse: (verse: number) => void
  onQueueVerse: (verse: number) => void
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
  onJumpProject,
  onSelectVerse,
  onDoubleClickVerse,
  onQueueVerse,
}: BiblePaneProps) {
  const [bookQuery, setBookQuery] = useState("")

  // View state machine:
  // - no book → books grid
  // - book but no chapter → chapter grid
  // - book + chapter → reader
  const view: "books" | "chapters" | "reader" =
    !selectedBook ? "books" : !selectedChapter ? "chapters" : "reader"

  const handleBackToBooks = () => onReferenceChange(null as unknown as BibleBook, null)
  const handleBackToChapters = () => {
    if (selectedBook) onReferenceChange(selectedBook, null)
  }

  return (
    <div className="h-full flex flex-col">
      <header className="h-14 shrink-0 px-4 border-b border-border flex items-center gap-3">
        <Breadcrumb
          book={selectedBook}
          chapter={selectedChapter}
          view={view}
          onHome={handleBackToBooks}
          onBookCrumb={handleBackToChapters}
          onChapterJump={(ch) => selectedBook && onReferenceChange(selectedBook, ch)}
        />

        <div className="flex-1" />

        <ScriptureTypeahead
          onProject={onJumpProject}
          onNavigate={(book, chapter) => onReferenceChange(book, chapter)}
        />

        <Select value={version} onValueChange={onVersionChange}>
          <SelectTrigger size="sm" className="h-9 w-auto min-w-0 px-2.5 gap-1.5 text-xs font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end" className="max-h-[60vh]">
            {BIBLE_VERSIONS.map((v) => (
              <SelectItem key={v.code} value={v.code} className="text-xs">
                <span className="font-mono mr-2">{v.code}</span>
                <span className="text-muted-foreground">{v.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      {/* Books view — keep its own search inline above the grid */}
      {view === "books" && (
        <>
          <div className="px-8 pt-6 pb-2 max-w-[1100px] mx-auto w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={bookQuery}
                onChange={(e) => setBookQuery(e.target.value)}
                placeholder="Search books"
                className="h-10 pl-10 text-sm"
                autoFocus
              />
              {bookQuery && (
                <button
                  onClick={() => setBookQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 size-6 grid place-items-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent"
                  aria-label="Clear"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>
          <BookGrid
            selectedBook={selectedBook}
            query={bookQuery}
            onSelect={(b) => onReferenceChange(b, null)}
          />
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

interface BreadcrumbProps {
  book: BibleBook | null
  chapter: number | null
  view: "books" | "chapters" | "reader"
  onHome: () => void
  onBookCrumb: () => void
  onChapterJump: (ch: number) => void
}

function Breadcrumb({
  book,
  chapter,
  view,
  onHome,
  onBookCrumb,
  onChapterJump,
}: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
      <CrumbButton
        onClick={onHome}
        active={view === "books"}
        label="Bible"
      />
      {book && (
        <>
          <Sep />
          <CrumbButton
            onClick={onBookCrumb}
            active={view === "chapters"}
            label={book.name}
          />
        </>
      )}
      {book && chapter && (
        <>
          <Sep />
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="px-1.5 h-7 rounded text-foreground font-medium hover:bg-accent transition-colors inline-flex items-center gap-1"
              >
                {chapter}
                <ChevronRight className="size-3 text-muted-foreground rotate-90" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={6} className="w-[280px] p-2">
              <div className="grid grid-cols-6 gap-1">
                {book.chapters.map((_, i) => {
                  const ch = i + 1
                  const active = chapter === ch
                  return (
                    <button
                      key={ch}
                      onClick={() => onChapterJump(ch)}
                      className={`h-8 text-xs font-mono rounded-sm border transition-colors ${
                        active
                          ? "bg-foreground text-background border-foreground"
                          : "border-border text-foreground hover:bg-accent hover:border-muted-foreground"
                      }`}
                    >
                      {ch}
                    </button>
                  )
                })}
              </div>
            </PopoverContent>
          </Popover>
        </>
      )}
    </nav>
  )
}

function CrumbButton({
  onClick,
  active,
  label,
}: {
  onClick: () => void
  active: boolean
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`px-1.5 h-7 rounded transition-colors inline-flex items-center ${
        active
          ? "text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      }`}
    >
      {label}
    </button>
  )
}

function Sep() {
  return (
    <ChevronRight className="size-3.5 text-muted-foreground/50 shrink-0" />
  )
}
