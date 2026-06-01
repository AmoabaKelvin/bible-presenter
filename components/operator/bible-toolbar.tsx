"use client"

import { ChevronRight, CloudDownload } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDownloadedBibleVersions } from "@/hooks/use-downloaded-bible-versions"
import { BIBLE_VERSIONS, type BibleBook } from "@/lib/bible-data"
import { OfflineManager } from "./offline-manager"
import { ScriptureTypeahead } from "./scripture-typeahead"

export type BiblePaneView = "books" | "chapters" | "reader"

interface BibleToolbarProps {
  book: BibleBook | null
  chapter: number | null
  view: BiblePaneView
  version: string
  onVersionChange: (version: string) => void
  onHome: () => void
  onBookCrumb: () => void
  onChapterJump: (chapter: number) => void
  onJumpSelect: (book: BibleBook, chapter: number, verse: number) => void
  onJumpProject: (book: BibleBook, chapter: number, verse: number) => void
  onNavigate: (book: BibleBook, chapter: number) => void
}

export function BibleToolbar({
  book,
  chapter,
  view,
  version,
  onVersionChange,
  onHome,
  onBookCrumb,
  onChapterJump,
  onJumpSelect,
  onJumpProject,
  onNavigate,
}: BibleToolbarProps) {
  const { downloadedVersions, refreshDownloadedVersions } = useDownloadedBibleVersions()

  return (
    <header className="h-14 shrink-0 px-4 border-b border-border flex items-center gap-3">
      <BibleBreadcrumb
        book={book}
        chapter={chapter}
        view={view}
        onHome={onHome}
        onBookCrumb={onBookCrumb}
        onChapterJump={onChapterJump}
      />

      <div className="flex-1" />

      <ScriptureTypeahead
        onSelect={onJumpSelect}
        onProject={onJumpProject}
        onNavigate={onNavigate}
      />

      <BibleVersionSelect
        version={version}
        downloadedVersions={downloadedVersions}
        onVersionChange={onVersionChange}
        onOpen={() => refreshDownloadedVersions()}
      />

      <OfflineDownloadsButton />
    </header>
  )
}

interface BibleBreadcrumbProps {
  book: BibleBook | null
  chapter: number | null
  view: BiblePaneView
  onHome: () => void
  onBookCrumb: () => void
  onChapterJump: (chapter: number) => void
}

function BibleBreadcrumb({
  book,
  chapter,
  view,
  onHome,
  onBookCrumb,
  onChapterJump,
}: BibleBreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
      <CrumbButton onClick={onHome} active={view === "books"} label="Bible" />
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
          <ChapterJumpMenu
            book={book}
            chapter={chapter}
            onChapterJump={onChapterJump}
          />
        </>
      )}
    </nav>
  )
}

function BibleVersionSelect({
  version,
  downloadedVersions,
  onVersionChange,
  onOpen,
}: {
  version: string
  downloadedVersions: Set<string>
  onVersionChange: (version: string) => void
  onOpen: () => void
}) {
  return (
    <Select
      value={version}
      onValueChange={onVersionChange}
      onOpenChange={(open) => open && onOpen()}
    >
      <SelectTrigger size="sm" className="h-9 w-auto min-w-0 px-2.5 gap-1.5 text-xs font-mono">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end" className="max-h-[60vh]">
        {BIBLE_VERSIONS.map((bibleVersion) => (
          <SelectItem key={bibleVersion.code} value={bibleVersion.code} className="text-xs">
            <span className="font-mono mr-2 inline-flex items-center gap-1.5">
              <span
                className={`size-1.5 rounded-full ${
                  downloadedVersions.has(bibleVersion.code) ? "bg-emerald-500" : "bg-transparent"
                }`}
                aria-label={
                  downloadedVersions.has(bibleVersion.code) ? "Available offline" : undefined
                }
              />
              {bibleVersion.code}
            </span>
            <span className="text-muted-foreground">{bibleVersion.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function ChapterJumpMenu({
  book,
  chapter,
  onChapterJump,
}: {
  book: BibleBook
  chapter: number
  onChapterJump: (chapter: number) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="px-1.5 h-7 rounded text-foreground font-medium hover:bg-accent transition-colors inline-flex items-center gap-1">
          {chapter}
          <ChevronRight className="size-3 text-muted-foreground rotate-90" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[280px] p-2">
        <div className="grid grid-cols-6 gap-1">
          {book.chapters.map((_, index) => {
            const chapterNumber = index + 1
            const active = chapter === chapterNumber
            return (
              <button
                key={chapterNumber}
                onClick={() => onChapterJump(chapterNumber)}
                className={`h-8 text-xs font-mono rounded-sm border transition-colors ${
                  active
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-foreground hover:bg-accent hover:border-muted-foreground"
                }`}
              >
                {chapterNumber}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function OfflineDownloadsButton() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-9 px-2.5 gap-1.5 text-xs"
          aria-label="Offline downloads"
        >
          <CloudDownload className="size-3.5" />
          Offline
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-auto p-3">
        <OfflineManager />
      </PopoverContent>
    </Popover>
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
  return <ChevronRight className="size-3.5 text-muted-foreground/50 shrink-0" />
}
