"use client"

import { useEffect, useState } from "react"
import { FolderInput, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Folder, SavedNote } from "./types"

// A small shared dialog for naming a folder — used for both "New folder" and
// "Rename folder" so the two flows look identical and avoid native prompts.
interface FolderNameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  initialName?: string
  submitLabel: string
  onSubmit: (name: string) => void
}

export function FolderNameDialog({
  open,
  onOpenChange,
  title,
  description,
  initialName = "",
  submitLabel,
  onSubmit,
}: FolderNameDialogProps) {
  const [name, setName] = useState(initialName)

  // Reset to the starting name each time the dialog opens.
  useEffect(() => {
    if (open) setName(initialName)
  }, [open, initialName])

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Folder name"
          autoFocus
        />
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={!name.trim()}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
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

function stripMd(value: string | undefined | null) {
  return (value ?? "").replace(/[*_#>`~-]/g, "").replace(/<[^>]+>/g, "").trim()
}

interface NoteRowProps {
  note: SavedNote
  active: boolean
  folders: Folder[]
  onSelect: (note: SavedNote) => void
  onDelete: (id: string) => void
  onMoveToFolder: (noteId: string, folderId: string | null) => void
}

// A single saved-note row, shared by every folder group and the Unfiled group.
// The move dropdown lets the operator re-file the note to any folder or back to
// Unfiled without leaving the list.
export function NoteRow({
  note,
  active,
  folders,
  onSelect,
  onDelete,
  onMoveToFolder,
}: NoteRowProps) {
  const preview = stripMd(note.slides?.[0]?.body)
  const slideCount = note.slides?.length ?? 0

  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-note-id", note.id)
        e.dataTransfer.effectAllowed = "move"
      }}
    >
      <button
        onClick={() => onSelect(note)}
        className={`group relative w-full text-left pl-3 pr-2 py-2.5 rounded-lg transition-colors cursor-grab active:cursor-grabbing ${
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
            className={`flex-1 min-w-0 truncate text-[13px] ${
              active ? "font-semibold" : "font-medium"
            }`}
          >
            {note.title.trim() || "Untitled note"}
          </span>
          <span className="flex items-center gap-0.5 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => event.stopPropagation()}
                  className="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 text-muted-foreground hover:text-foreground transition-all"
                  aria-label="Move note to folder"
                >
                  <FolderInput className="size-3.5" />
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuRadioGroup
                  value={note.folderId ?? ""}
                  onValueChange={(value) =>
                    onMoveToFolder(note.id, value === "" ? null : value)
                  }
                >
                  <DropdownMenuRadioItem value="">Unfiled</DropdownMenuRadioItem>
                  {folders.length > 0 && <DropdownMenuSeparator />}
                  {folders.map((folder) => (
                    <DropdownMenuRadioItem key={folder.id} value={folder.id}>
                      <span className="truncate">{folder.name}</span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation()
                onDelete(note.id)
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  event.stopPropagation()
                  onDelete(note.id)
                }
              }}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
              aria-label="Delete note"
            >
              <Trash2 className="size-3.5" />
            </span>
          </span>
        </div>
        <p className="text-[11.5px] text-muted-foreground line-clamp-1 mt-0.5">
          {preview || "Empty deck"}
        </p>
        <p className="text-[10px] text-muted-foreground/60 font-mono mt-1">
          {slideCount} {slideCount === 1 ? "slide" : "slides"} · {relativeTime(note.updatedAt)}
        </p>
      </button>
    </li>
  )
}

interface FolderHeaderProps {
  folder: Folder
  count: number
  collapsed: boolean
  onToggle: () => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

// A collapsible folder group header carrying the folder name, note count, and
// rename/delete controls. Renaming uses the dropdown rather than an inline edit
// to keep the row compact and consistent with the move menu.
export function FolderHeader({
  folder,
  count,
  collapsed,
  onToggle,
  onRename,
  onDelete,
}: FolderHeaderProps) {
  const [renameOpen, setRenameOpen] = useState(false)
  return (
    <>
    <div className="group flex items-center gap-1 px-2 py-1">
      <button
        onClick={onToggle}
        className="flex-1 min-w-0 flex items-center gap-1.5 text-left"
        aria-expanded={!collapsed}
      >
        <svg
          className={`size-3 text-muted-foreground transition-transform ${collapsed ? "" : "rotate-90"}`}
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden
        >
          <path d="M4.5 3L8 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {folder.name}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground/60 tabular-nums">{count}</span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 size-5 grid place-items-center rounded text-muted-foreground hover:text-foreground transition-all"
            aria-label="Folder options"
          >
            <svg viewBox="0 0 12 12" className="size-3" fill="currentColor" aria-hidden>
              <circle cx="2" cy="6" r="1" />
              <circle cx="6" cy="6" r="1" />
              <circle cx="10" cy="6" r="1" />
            </svg>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => onDelete(folder.id)}
          >
            Delete folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
      <FolderNameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Rename folder"
        initialName={folder.name}
        submitLabel="Rename"
        onSubmit={(name) => onRename(folder.id, name)}
      />
    </>
  )
}
