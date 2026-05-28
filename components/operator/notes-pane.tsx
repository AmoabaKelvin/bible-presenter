"use client"

import { useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Eye,
  Plus,
  Radio,
  Trash2,
  PencilLine,
  Check,
} from "lucide-react"
import type { SavedNote } from "./types"

interface NotesPaneProps {
  title: string
  text: string
  savedNotes: SavedNote[]
  activeNoteId: string | null
  onTitleChange: (v: string) => void
  onTextChange: (v: string) => void
  onSelectNote: (note: SavedNote) => void
  onNewNote: () => void
  onDeleteNote: (id: string) => void
  onPreview: () => void
  onProject: () => void
  onAddToQueue: () => void
}

function relativeTime(ts: number) {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60_000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function stripMd(s: string) {
  return s.replace(/[*_#>`~-]/g, "").replace(/<[^>]+>/g, "").trim()
}

export function NotesPane({
  title,
  text,
  savedNotes,
  activeNoteId,
  onTitleChange,
  onTextChange,
  onSelectNote,
  onNewNote,
  onDeleteNote,
  onPreview,
  onProject,
  onAddToQueue,
}: NotesPaneProps) {
  const taRef = useRef<HTMLTextAreaElement>(null)

  const wrap = (prefix: string, suffix = prefix) => {
    const ta = taRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const before = text.substring(0, start)
    const sel = text.substring(start, end)
    const after = text.substring(end)
    onTextChange(`${before}${prefix}${sel}${suffix}${after}`)
    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(start + prefix.length, end + prefix.length)
    }, 0)
  }

  const isEmpty = !title.trim() && !text.trim()
  const sortedNotes = useMemo(
    () => [...savedNotes].sort((a, b) => b.updatedAt - a.updatedAt),
    [savedNotes],
  )

  const activeNote = savedNotes.find((n) => n.id === activeNoteId)
  const dirty = activeNote
    ? activeNote.title !== title || activeNote.body !== text
    : !isEmpty
  const saveStatus = isEmpty ? "" : dirty ? "Saving…" : "Saved"

  return (
    <div className="h-full flex">
      {/* ── Saved notes list ── */}
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
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteNote(note.id)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              e.stopPropagation()
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

      {/* ── Editor ── */}
      <div className="flex-1 min-w-0 flex flex-col h-full min-h-0">
        {/* Status strip */}
        <div className="h-14 shrink-0 px-6 border-b border-border flex items-center justify-end">
          {saveStatus && (
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {saveStatus === "Saved" && <Check className="size-3" />}
              {saveStatus}
            </span>
          )}
        </div>

        {/* Document */}
        <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
          <div className="mx-auto w-full max-w-[720px] px-10 pt-8 pb-6 flex flex-col min-h-full">
            <input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Untitled note"
              className="w-full bg-transparent border-0 outline-none text-[26px] font-semibold tracking-tight placeholder:text-muted-foreground/35 mb-3"
            />
            <textarea
              ref={taRef}
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="Start writing…"
              className="flex-1 min-h-[320px] w-full resize-none border-0 bg-transparent p-0 outline-none text-[19px] leading-9 text-foreground placeholder:text-muted-foreground/35"
            />
          </div>
        </div>

        {/* Toolbar + project actions */}
        <div className="shrink-0 border-t border-border px-6 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-0.5">
            <ToolBtn label="Bold" onClick={() => wrap("**")}>
              <Bold className="size-3.5" />
            </ToolBtn>
            <ToolBtn label="Italic" onClick={() => wrap("*")}>
              <Italic className="size-3.5" />
            </ToolBtn>
            <ToolBtn label="Underline" onClick={() => wrap("<u>", "</u>")}>
              <Underline className="size-3.5" />
            </ToolBtn>
            <span className="w-px h-4 bg-border mx-1" />
            <ToolBtn label="Bullet list" onClick={() => wrap("- ", "")}>
              <List className="size-3.5" />
            </ToolBtn>
            <ToolBtn label="Numbered list" onClick={() => wrap("1. ", "")}>
              <ListOrdered className="size-3.5" />
            </ToolBtn>
          </div>

          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onPreview} disabled={isEmpty}>
              <Eye className="size-3.5 mr-1.5" />
              Preview
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onAddToQueue} disabled={isEmpty}>
              <Plus className="size-3.5 mr-1.5" />
              Queue
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={onProject} disabled={isEmpty}>
              <Radio className="size-3.5 mr-1.5" />
              Go live
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ToolBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="size-7 grid place-items-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
    >
      {children}
    </button>
  )
}
