"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Upload, Trash2, Radio, Eye, ImageOff } from "lucide-react"
import type { MediaItem } from "./types"
import { resolveImageUrl } from "@/lib/image-store"

interface MediaPaneProps {
  items: MediaItem[]
  onUpload: (file: File) => void
  onDelete: (id: string) => void
  onPreview: (item: MediaItem) => void
  onProject: (item: MediaItem) => void
}

export function MediaPane({
  items,
  onUpload,
  onDelete,
  onPreview,
  onProject,
}: MediaPaneProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return
      onUpload(file)
    })
  }

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between px-6 pt-6 pb-3">
        <div>
          <h2 className="text-sm font-medium">Media library</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {items.length} item{items.length === 1 ? "" : "s"} · click to preview, double-click to go live
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-3.5 mr-1.5" />
          Upload
        </Button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ""
          }}
        />
      </header>

      <ScrollArea className="flex-1 min-h-0">
        {items.length === 0 ? (
          <DropZone onFiles={handleFiles} onPick={() => fileRef.current?.click()} />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 p-6 pt-2">
            {items.map((item) => (
              <MediaTile
                key={item.id}
                item={item}
                onDelete={() => onDelete(item.id)}
                onPreview={() => onPreview(item)}
                onProject={() => onProject(item)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

function MediaTile({
  item,
  onDelete,
  onPreview,
  onProject,
}: {
  item: MediaItem
  onDelete: () => void
  onPreview: () => void
  onProject: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    resolveImageUrl(item.imageId ?? item.dataUrl).then((u) => {
      if (!cancelled) setUrl(u)
    })
    return () => {
      cancelled = true
    }
  }, [item.imageId, item.dataUrl])

  return (
    <div className="group relative aspect-video rounded-md overflow-hidden border border-border bg-card">
      <button
        onClick={onPreview}
        onDoubleClick={onProject}
        className="absolute inset-0"
        aria-label={`Preview ${item.name}`}
      >
        {url ? (
          <img
            src={url}
            alt={item.name}
            className="absolute inset-0 size-full object-cover transition-transform group-hover:scale-[1.02]"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-muted-foreground">
            <ImageOff className="size-4" />
          </span>
        )}
      </button>

      <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 bg-gradient-to-t from-black/70 via-black/30 to-transparent flex items-end justify-between gap-2">
        <span className="text-[11px] text-white truncate font-mono">{item.name}</span>
      </div>

      <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 w-7 p-0"
              onClick={onPreview}
            >
              <Eye className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Preview</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 w-7 p-0"
              onClick={onProject}
            >
              <Radio className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Go live</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Remove</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

function DropZone({
  onFiles,
  onPick,
}: {
  onFiles: (f: FileList | null) => void
  onPick: () => void
}) {
  return (
    <div
      className="m-6 mt-2 rounded-md border border-dashed border-border bg-card/40 p-12 flex flex-col items-center justify-center text-center min-h-[300px]"
      onDragOver={(e) => {
        e.preventDefault()
        e.currentTarget.classList.add("border-foreground/50", "bg-accent/40")
      }}
      onDragLeave={(e) => {
        e.currentTarget.classList.remove("border-foreground/50", "bg-accent/40")
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.currentTarget.classList.remove("border-foreground/50", "bg-accent/40")
        onFiles(e.dataTransfer.files)
      }}
    >
      <div className="size-10 grid place-items-center rounded-full bg-accent mb-3">
        <Upload className="size-4 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">Drop images here</p>
      <p className="text-xs text-muted-foreground mt-1 mb-4">PNG, JPG, GIF — any aspect ratio</p>
      <Button size="sm" variant="outline" onClick={onPick}>
        <Upload className="size-3.5 mr-1.5" />
        Or browse files
      </Button>
    </div>
  )
}
