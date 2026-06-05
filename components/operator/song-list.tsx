"use client"

import { useMemo, useState } from "react"
import { Music, Plus, Trash2, Search } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Song } from "./types"

interface SongListProps {
  songs: Song[]
  activeSongId: string | null
  onSelect: (song: Song) => void
  onNew: () => void
  onDelete: (id: string) => void
}

function firstLine(song: Song): string {
  for (const slide of song.slides) {
    for (const line of slide.lines) {
      if (line.trim()) return line.trim()
    }
  }
  return "Empty song"
}

function songText(song: Song): string {
  return song.slides.map((s) => s.lines.join(" ")).join(" ").toLowerCase()
}

export function SongList({
  songs,
  activeSongId,
  onSelect,
  onNew,
  onDelete,
}: SongListProps) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = q
      ? songs.filter(
          (s) => s.title.toLowerCase().includes(q) || songText(s).includes(q),
        )
      : songs
    return [...matches].sort((a, b) => b.updatedAt - a.updatedAt)
  }, [songs, query])

  return (
    <aside className="w-[320px] shrink-0 border-r border-border flex flex-col h-full min-h-0 bg-card/20">
      <div className="h-14 shrink-0 px-4 border-b border-border flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-medium">Songs</h2>
          {songs.length > 0 && (
            <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
              {songs.length}
            </span>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onNew}
              className="size-7 grid place-items-center rounded-md border border-border bg-background hover:bg-accent transition-colors"
              aria-label="New song"
            >
              <Plus className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">New song</TooltipContent>
        </Tooltip>
      </div>

      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search songs"
            className="w-full h-8 pl-8 pr-2 rounded-md bg-muted/40 border border-transparent focus:border-border outline-none text-[13px] placeholder:text-muted-foreground/50"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <div className="size-9 rounded-full bg-accent grid place-items-center mx-auto mb-3">
              <Music className="size-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {query ? "No songs match." : "Paste lyrics to add your first song."}
            </p>
          </div>
        ) : (
          <ul className="p-1.5 space-y-px">
            {filtered.map((song) => {
              const active = song.id === activeSongId
              const requestDelete = (event: React.SyntheticEvent) => {
                event.stopPropagation()
                onDelete(song.id)
              }
              return (
                <li key={song.id}>
                  <button
                    onClick={() => onSelect(song)}
                    className={`group relative w-full text-left pl-3 pr-2 py-2.5 rounded-lg transition-colors ${
                      active ? "bg-accent" : "hover:bg-accent/50"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full transition-colors ${
                        active ? "bg-foreground" : "bg-transparent"
                      }`}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className={`flex-1 min-w-0 truncate text-[13px] ${active ? "font-semibold" : "font-medium"}`}>
                        {song.title.trim() || "Untitled song"}
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={requestDelete}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            requestDelete(event)
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
                        aria-label="Delete song"
                      >
                        <Trash2 className="size-3.5" />
                      </span>
                    </div>
                    <p className="text-[11.5px] text-muted-foreground line-clamp-1 mt-0.5">
                      {firstLine(song)}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 font-mono mt-1">
                      {song.slides.length} {song.slides.length === 1 ? "slide" : "slides"}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </ScrollArea>
    </aside>
  )
}
