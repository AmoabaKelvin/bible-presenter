"use client"

import { useMemo } from "react"
import { PencilLine, Plus, Trash2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { SavedNote } from "./types"

interface NotesListProps {
  notes: SavedNote[]
  activeNoteId: string | null
  onSelectNote: (note: SavedNote) => void
  onNewNote: () => void
  onDeleteNote: (id: string) => void
}

function relativeTime(ts: number) {
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function stripMd(value: string) {
  return value.replace(/[*_#>`~-]/g, "").replace(/<[^>]+>/g, "").trim()
}

export function NotesList({
  notes,
  activeNoteId,
  onSelectNote,
  onNewNote,
  onDeleteNote,
}: NotesListProps) {
  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => b.updatedAt - a.updatedAt),
    [notes],
  )

  return (
    <aside className="w-[320px] shrink-0 border-r border-border flex flex-col h-full min-h-0 bg-card/20">
      <div className="h-14 shrink-0 px-4 border-b border-border flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-medium">Notes</h2>
          {sortedNotes.length > 0 && (
            <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
              {sortedNotes.length}
            </span>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onNewNote}
              className="size-7 grid place-items-center rounded-md border border-border bg-background hover:bg-accent transition-colors"
              aria-label="New note"
            >
              <Plus className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">New note</TooltipContent>
        </Tooltip>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {sortedNotes.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <div className="size-9 rounded-full bg-accent grid place-items-center mx-auto mb-3">
              <PencilLine className="size-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Start writing and your notes save automatically.
            </p>
          </div>
        ) : (
          <ul className="p-1.5 space-y-px">
            {sortedNotes.map((note) => {
              const active = note.id === activeNoteId
              const preview = stripMd(note.body)
              return (
                <li key={note.id}>
                  <button
                    onClick={() => onSelectNote(note)}
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
                      <span
                        className={`text-[13px] truncate ${
                          active ? "font-semibold" : "font-medium"
                        }`}
                      >
                        {note.title.trim() || "Untitled note"}
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation()
                          onDeleteNote(note.id)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            event.stopPropagation()
                            onDeleteNote(note.id)
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
                        aria-label="Delete note"
                      >
                        <Trash2 className="size-3.5" />
                      </span>
                    </div>
                    <p className="text-[11.5px] text-muted-foreground line-clamp-1 mt-0.5">
                      {preview || "No additional text"}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 font-mono mt-1">
                      {relativeTime(note.updatedAt)}
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
