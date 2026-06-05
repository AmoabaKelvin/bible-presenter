"use client"

import { useState } from "react"
import { Plus, ListPlus, ClipboardPaste, Music, Trash2 } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { SongList } from "./song-list"
import { SongSlideCard } from "./song-slide-card"
import { PasteSongDialog } from "./paste-song-dialog"
import type { Song, SongSlide } from "./types"
import type { SelectedVerse } from "@/components/slide-stage"
import { songSlideToVerse, songToVerses } from "@/lib/song-slides"

interface SongsPaneProps {
  song: Song | null
  songs: Song[]
  activeSongId: string | null
  newSlideId: string | null
  liveVerses: SelectedVerse[]
  onTitleChange: (title: string) => void
  onSlideChange: (slideId: string, patch: Partial<Pick<SongSlide, "label" | "lines">>) => void
  onAddSlide: () => void
  onDeleteSlide: (slideId: string) => void
  onMoveSlide: (slideId: string, direction: -1 | 1) => void
  onSelectSong: (song: Song) => void
  onNewSong: () => void
  onCreateFromPaste: (title: string, lyrics: string) => void
  onDeleteSong: (id: string) => void
  previewSlide: (verse: SelectedVerse) => void
  projectSlide: (verse: SelectedVerse) => void
  addToQueue: (verses: SelectedVerse[]) => void
}

export function SongsPane({
  song,
  songs,
  activeSongId,
  newSlideId,
  liveVerses,
  onTitleChange,
  onSlideChange,
  onAddSlide,
  onDeleteSlide,
  onMoveSlide,
  onSelectSong,
  onNewSong,
  onCreateFromPaste,
  onDeleteSong,
  previewSlide,
  projectSlide,
  addToQueue,
}: SongsPaneProps) {
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Song | null>(null)
  const slides = song?.slides ?? []
  // Mark the card whose lyrics match what's currently on the live output.
  const liveTexts = new Set(
    liveVerses.filter((v) => v.kind === "song").map((v) => v.text),
  )

  const queueAll = () => {
    if (!song) return
    const verses = songToVerses(song)
    if (verses.length) addToQueue(verses)
  }

  return (
    <div className="h-full flex">
      <SongList
        songs={songs}
        activeSongId={activeSongId}
        onSelect={onSelectSong}
        onNew={() => setPasteOpen(true)}
        onDelete={(id) => setPendingDelete(songs.find((s) => s.id === id) ?? null)}
      />

      {!song ? (
        <div className="flex-1 grid place-items-center">
          <div className="text-center">
            <div className="size-10 rounded-full bg-accent grid place-items-center mx-auto mb-4">
              <Music className="size-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Paste lyrics copied from the web — a blank line starts a new slide —
              or start a blank song.
            </p>
            <Button onClick={() => setPasteOpen(true)} size="sm">
              <ClipboardPaste className="size-3.5 mr-1.5" />
              New song
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-w-0 flex flex-col h-full min-h-0">
          <div className="h-14 shrink-0 px-6 border-b border-border flex items-center gap-3">
            <input
              value={song.title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Untitled song"
              className="flex-1 bg-transparent border-0 outline-none text-[20px] font-semibold tracking-tight placeholder:text-muted-foreground/35"
            />
            <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
              {slides.length} {slides.length === 1 ? "slide" : "slides"}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setPendingDelete(song)}
                  aria-label="Delete song"
                  className="size-7 grid place-items-center rounded-md text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Delete song</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
            <div className="mx-auto w-full max-w-[760px] px-8 py-6 space-y-3">
              {slides.map((slide, i) => (
                <SongSlideCard
                  key={slide.id}
                  slide={slide}
                  index={i}
                  total={slides.length}
                  isNew={slide.id === newSlideId}
                  isLive={liveTexts.has(slide.lines.join("\n"))}
                  onChange={(patch) => onSlideChange(slide.id, patch)}
                  onPreview={() => previewSlide(songSlideToVerse(slide, song.title))}
                  onProject={() => projectSlide(songSlideToVerse(slide, song.title))}
                  onQueue={() => addToQueue([songSlideToVerse(slide, song.title)])}
                  onDelete={() => onDeleteSlide(slide.id)}
                  onMoveUp={() => onMoveSlide(slide.id, -1)}
                  onMoveDown={() => onMoveSlide(slide.id, 1)}
                />
              ))}

              <button
                type="button"
                onClick={() => onAddSlide()}
                className="w-full h-10 grid place-items-center rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-accent/40 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Plus className="size-4" />
                  Add slide
                </span>
              </button>
            </div>
          </div>

          <div className="shrink-0 border-t border-border px-6 py-2.5 flex items-center justify-end gap-3">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={queueAll}>
              <ListPlus className="size-3.5 mr-1.5" />
              Queue all slides
            </Button>
          </div>
        </div>
      )}

      <PasteSongDialog
        open={pasteOpen}
        onOpenChange={setPasteOpen}
        onCreate={onCreateFromPaste}
        onStartBlank={onNewSong}
      />

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this song?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{pendingDelete?.title.trim() || "Untitled song"}&rdquo; will be
              permanently removed. This can&rsquo;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) onDeleteSong(pendingDelete.id)
                setPendingDelete(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
