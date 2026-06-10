"use client"

import { useMemo, useState } from "react"
import { FolderPlus, PencilLine, Plus } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { FolderHeader, NoteRow } from "./note-folder-row"
import type { Folder, SavedNote } from "./types"

interface NotesListProps {
  notes: SavedNote[]
  folders: Folder[]
  activeNoteId: string | null
  onSelectNote: (note: SavedNote) => void
  onNewNote: () => void
  onDeleteNote: (id: string) => void
  onCreateFolder: (name: string) => void
  onRenameFolder: (id: string, name: string) => void
  onDeleteFolder: (id: string) => void
  onMoveNoteToFolder: (noteId: string, folderId: string | null) => void
}

export function NotesList({
  notes,
  folders,
  activeNoteId,
  onSelectNote,
  onNewNote,
  onDeleteNote,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveNoteToFolder,
}: NotesListProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const sortedFolders = useMemo(
    () => [...folders].sort((a, b) => a.name.localeCompare(b.name)),
    [folders],
  )

  // Bucket notes by folder; unknown/absent ids land in Unfiled. Each bucket
  // keeps the most-recently-updated note first.
  const { byFolder, unfiled } = useMemo(() => {
    const known = new Set(folders.map((f) => f.id))
    const byFolder = new Map<string, SavedNote[]>()
    const unfiled: SavedNote[] = []
    for (const note of notes) {
      if (note.folderId && known.has(note.folderId)) {
        const bucket = byFolder.get(note.folderId) ?? []
        bucket.push(note)
        byFolder.set(note.folderId, bucket)
      } else {
        unfiled.push(note)
      }
    }
    const byUpdated = (a: SavedNote, b: SavedNote) => b.updatedAt - a.updatedAt
    byFolder.forEach((bucket) => bucket.sort(byUpdated))
    unfiled.sort(byUpdated)
    return { byFolder, unfiled }
  }, [notes, folders])

  const toggleFolder = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const addFolder = () => {
    const name = window.prompt("New folder name")
    if (name !== null) onCreateFolder(name)
  }

  return (
    <aside className="w-[320px] shrink-0 border-r border-border flex flex-col h-full min-h-0 bg-card/20">
      <div className="h-14 shrink-0 px-4 border-b border-border flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-medium">Notes</h2>
          {notes.length > 0 && (
            <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
              {notes.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={addFolder}
                className="size-7 grid place-items-center rounded-md border border-border bg-background hover:bg-accent transition-colors"
                aria-label="New folder"
              >
                <FolderPlus className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New folder</TooltipContent>
          </Tooltip>
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
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {notes.length === 0 && folders.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <div className="size-9 rounded-full bg-accent grid place-items-center mx-auto mb-3">
              <PencilLine className="size-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Start writing and your notes save automatically.
            </p>
          </div>
        ) : (
          <div className="p-1.5 space-y-1">
            {sortedFolders.map((folder) => {
              const bucket = byFolder.get(folder.id) ?? []
              const isCollapsed = collapsed.has(folder.id)
              return (
                <div key={folder.id}>
                  <FolderHeader
                    folder={folder}
                    count={bucket.length}
                    collapsed={isCollapsed}
                    onToggle={() => toggleFolder(folder.id)}
                    onRename={onRenameFolder}
                    onDelete={onDeleteFolder}
                  />
                  {!isCollapsed && (
                    <ul className="space-y-px">
                      {bucket.length === 0 ? (
                        <li className="px-3 py-1.5 text-[11px] text-muted-foreground/60">
                          Empty folder
                        </li>
                      ) : (
                        bucket.map((note) => (
                          <NoteRow
                            key={note.id}
                            note={note}
                            active={note.id === activeNoteId}
                            folders={sortedFolders}
                            onSelect={onSelectNote}
                            onDelete={onDeleteNote}
                            onMoveToFolder={onMoveNoteToFolder}
                          />
                        ))
                      )}
                    </ul>
                  )}
                </div>
              )
            })}

            <div>
              {sortedFolders.length > 0 && (
                <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Unfiled
                </div>
              )}
              <ul className="space-y-px">
                {unfiled.map((note) => (
                  <NoteRow
                    key={note.id}
                    note={note}
                    active={note.id === activeNoteId}
                    folders={sortedFolders}
                    onSelect={onSelectNote}
                    onDelete={onDeleteNote}
                    onMoveToFolder={onMoveNoteToFolder}
                  />
                ))}
              </ul>
            </div>
          </div>
        )}
      </ScrollArea>
    </aside>
  )
}
