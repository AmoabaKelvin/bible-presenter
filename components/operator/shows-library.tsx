"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Download, Layers, MoreHorizontal, Play, Plus, Upload } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { SavedShow, ShowSnapshot } from "./types"
import {
  deleteShow,
  exportFileName,
  exportShow,
  importShowFile,
  listShows,
  renameShow,
  saveShow,
} from "@/lib/show-store"

interface ShowsLibraryProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  captureSnapshot: () => ShowSnapshot
  restoreSnapshot: (snapshot: ShowSnapshot) => void
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

function summarize(snapshot: ShowSnapshot): string {
  const queueCount = snapshot.queue.length
  const live = snapshot.liveVerses[0]?.reference
  const parts: string[] = []
  parts.push(`${queueCount} ${queueCount === 1 ? "cue" : "cues"}`)
  if (live) parts.push(`live: ${live}`)
  parts.push(snapshot.version)
  return parts.join(" · ")
}

export function ShowsLibrary({
  open,
  onOpenChange,
  captureSnapshot,
  restoreSnapshot,
}: ShowsLibraryProps) {
  const [shows, setShows] = useState<SavedShow[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(() => setShows(listShows()), [])

  // Re-read the library whenever the dialog opens (covers external changes).
  useEffect(() => {
    if (open) refresh()
  }, [open, refresh])

  const handleSaveCurrent = useCallback(() => {
    const name = window.prompt("Name this show", `Show ${new Date().toLocaleString()}`)
    if (name === null) return
    saveShow(name, captureSnapshot())
    refresh()
  }, [captureSnapshot, refresh])

  const handleRestore = useCallback(
    (show: SavedShow) => {
      restoreSnapshot(show.snapshot)
      onOpenChange(false)
    },
    [restoreSnapshot, onOpenChange],
  )

  const handleRename = useCallback(
    (show: SavedShow) => {
      const next = window.prompt("Rename show", show.name)
      if (next === null) return
      renameShow(show.id, next)
      refresh()
    },
    [refresh],
  )

  const handleDelete = useCallback(
    (show: SavedShow) => {
      if (!window.confirm(`Delete “${show.name}”? This can't be undone.`)) return
      deleteShow(show.id)
      refresh()
    },
    [refresh],
  )

  const handleExport = useCallback(async (show: SavedShow) => {
    try {
      const blob = await exportShow(show)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = exportFileName(show)
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("FlowCast: failed to export show", err)
      window.alert("Could not export this show.")
    }
  }, [])

  const handleImportFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = "" // allow re-importing the same file
      if (!file) return
      try {
        await importShowFile(file)
        refresh()
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Could not import this show.")
      }
    },
    [refresh],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Shows</DialogTitle>
          <DialogDescription>
            Save the current queue, live verse, backgrounds, look, and version, then
            return to it any time.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4 flex items-center gap-2">
          <Button size="sm" className="flex-1" onClick={handleSaveCurrent}>
            <Plus className="size-4" />
            Save current as show
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-4" />
            Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".flowshow,application/json"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>

        <div className="border-t border-border">
          {shows.length === 0 ? (
            <div className="min-h-[200px] grid place-items-center px-6 py-10">
              <div className="flex flex-col items-center text-center">
                <span className="size-11 grid place-items-center rounded-full bg-accent mb-3">
                  <Layers className="size-5 text-muted-foreground" />
                </span>
                <p className="text-sm font-medium">No saved shows yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[280px] leading-relaxed">
                  Save the current state above, or import a{" "}
                  <span className="font-mono">.flowshow</span> file to bring one back.
                </p>
              </div>
            </div>
          ) : (
            <ScrollArea className="max-h-[55vh]">
              <ul className="p-2 space-y-1">
                {shows.map((show) => (
                <li
                  key={show.id}
                  className="group flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-2.5 hover:bg-accent/50 hover:border-border transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-[13px] font-medium">{show.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {summarize(show.snapshot)}
                      <span className="text-muted-foreground/50"> · {relativeTime(show.updatedAt)}</span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleRestore(show)}
                  >
                    <Play className="size-3.5" />
                    Restore
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Show options"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onSelect={() => handleRename(show)}>
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleExport(show)}>
                        <Download className="size-4" />
                        Export
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => handleDelete(show)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
              </ul>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
