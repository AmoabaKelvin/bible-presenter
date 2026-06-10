"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Upload, Trash2, Radio, Eye, ImageOff, Image as ImageIcon } from "lucide-react"
import type { MediaItem } from "./types"
import type { BackgroundTarget } from "@/lib/background-config"
import { resolveImageUrl } from "@/lib/image-store"

const BACKGROUND_TARGETS: { value: BackgroundTarget; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "scripture", label: "Scripture" },
  { value: "song", label: "Songs" },
  { value: "note", label: "Notes" },
  { value: "definition", label: "Dictionary" },
]

const TILE_MIN_WIDTH = 180
const TILE_GAP = 12
const GRID_PADDING_X = 48
const GRID_PADDING_TOP = 8
const OVERSCAN_ROWS = 3

interface MediaPaneProps {
  items: MediaItem[]
  onUpload: (file: File) => void
  onDelete: (id: string) => void
  onPreview: (item: MediaItem) => void
  onProject: (item: MediaItem) => void
  onPrepare: (item: MediaItem) => void
  onSetBackground: (item: MediaItem, target: BackgroundTarget) => void
}

export function MediaPane({
  items,
  onUpload,
  onDelete,
  onPreview,
  onProject,
  onPrepare,
  onSetBackground,
}: MediaPaneProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ height: 0, scrollTop: 0, width: 0 })

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return
      onUpload(file)
    })
  }

  const updateViewport = useCallback(() => {
    const node = viewportRef.current
    if (!node) return

    const next = {
      height: node.clientHeight,
      scrollTop: node.scrollTop,
      width: node.clientWidth,
    }
    setViewport((current) =>
      current.height === next.height &&
      current.scrollTop === next.scrollTop &&
      current.width === next.width
        ? current
        : next,
    )
  }, [])

  useEffect(() => {
    updateViewport()
    const node = viewportRef.current
    if (!node) return

    const observer = new ResizeObserver(updateViewport)
    observer.observe(node)
    window.addEventListener("resize", updateViewport)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", updateViewport)
    }
  }, [updateViewport])

  const virtualGrid = useMemo(() => {
    const contentWidth = Math.max(TILE_MIN_WIDTH, viewport.width - GRID_PADDING_X)
    const columnCount = Math.max(
      1,
      Math.floor((contentWidth + TILE_GAP) / (TILE_MIN_WIDTH + TILE_GAP)),
    )
    const tileWidth = (contentWidth - TILE_GAP * (columnCount - 1)) / columnCount
    const rowHeight = tileWidth * (9 / 16)
    const rowStride = rowHeight + TILE_GAP
    const totalRows = Math.ceil(items.length / columnCount)
    const rowScrollTop = Math.max(0, viewport.scrollTop - GRID_PADDING_TOP)
    const visibleStartRow = Math.floor(rowScrollTop / rowStride)
    const visibleEndRow = Math.ceil((rowScrollTop + viewport.height) / rowStride)
    const startRow = Math.max(0, visibleStartRow - OVERSCAN_ROWS)
    const endRow = Math.min(totalRows, visibleEndRow + OVERSCAN_ROWS)
    const startIndex = startRow * columnCount
    const endIndex = Math.min(items.length, endRow * columnCount)
    const totalHeight =
      totalRows > 0 ? totalRows * rowHeight + Math.max(0, totalRows - 1) * TILE_GAP : 0

    return {
      columnCount,
      items: items.slice(startIndex, endIndex).map((item, visibleIndex) => ({
        item,
        index: startIndex + visibleIndex,
      })),
      offsetTop: startRow * rowStride,
      totalHeight,
    }
  }, [items, viewport.height, viewport.scrollTop, viewport.width])

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

      <div
        ref={viewportRef}
        className="flex-1 min-h-0 overflow-y-auto"
        onScroll={updateViewport}
      >
        {items.length === 0 ? (
          <DropZone onFiles={handleFiles} onPick={() => fileRef.current?.click()} />
        ) : (
          <div className="p-6 pt-2">
            <div className="relative" style={{ height: virtualGrid.totalHeight }}>
              <div
                className="absolute inset-x-0 top-0 grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${virtualGrid.columnCount}, minmax(0, 1fr))`,
                  transform: `translateY(${virtualGrid.offsetTop}px)`,
                }}
              >
                {virtualGrid.items.map(({ item, index }) => (
                  <MediaTile
                    key={item.id}
                    item={item}
                    index={index}
                    onDelete={onDelete}
                    onPreview={onPreview}
                    onProject={onProject}
                    onPrepare={onPrepare}
                    onSetBackground={onSetBackground}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const MediaTile = memo(function MediaTile({
  item,
  index,
  onDelete,
  onPreview,
  onProject,
  onPrepare,
  onSetBackground,
}: {
  item: MediaItem
  index: number
  onDelete: (id: string) => void
  onPreview: (item: MediaItem) => void
  onProject: (item: MediaItem) => void
  onPrepare: (item: MediaItem) => void
  onSetBackground: (item: MediaItem, target: BackgroundTarget) => void
}) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    resolveImageUrl(item.thumbnailId ?? item.imageId ?? item.dataUrl).then((u) => {
      if (!cancelled) setUrl(u)
    })
    return () => {
      cancelled = true
    }
  }, [item.dataUrl, item.imageId, item.thumbnailId])

  const handleDelete = useCallback(() => onDelete(item.id), [item.id, onDelete])
  const handlePreview = useCallback(() => onPreview(item), [item, onPreview])
  const handleProject = useCallback(() => onProject(item), [item, onProject])
  const handlePrepare = useCallback(() => onPrepare(item), [item, onPrepare])

  return (
    <div
      className="group relative aspect-video rounded-md overflow-hidden border border-border bg-card"
      style={{ contentVisibility: "auto", containIntrinsicSize: "180px 101px" }}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            onClick={handlePreview}
            onDoubleClick={handleProject}
            onFocus={handlePrepare}
            onMouseEnter={handlePrepare}
            onPointerDown={handlePrepare}
            className="absolute inset-0"
            aria-label={`Preview ${item.name}`}
          >
            {url ? (
              <img
                src={url}
                alt={item.name}
                loading="lazy"
                decoding="async"
                fetchPriority={index < 24 ? "high" : "auto"}
                className="absolute inset-0 size-full object-cover transition-transform group-hover:scale-[1.02]"
              />
            ) : (
              <span className="absolute inset-0 grid place-items-center text-muted-foreground">
                <ImageOff className="size-4" />
              </span>
            )}
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onSelect={handlePreview}>
            <Eye className="size-3.5" />
            Preview
          </ContextMenuItem>
          <ContextMenuItem onSelect={handleProject}>
            <Radio className="size-3.5" />
            Go live
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <ImageIcon className="size-3.5" />
              Set as background
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuLabel className="text-[11px] text-muted-foreground">
                Apply to
              </ContextMenuLabel>
              {BACKGROUND_TARGETS.map((target) => (
                <ContextMenuItem
                  key={target.value}
                  onSelect={() => onSetBackground(item, target.value)}
                >
                  {target.label}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onSelect={handleDelete}>
            <Trash2 className="size-3.5" />
            Remove
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

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
              onClick={handlePreview}
              onFocus={handlePrepare}
              onMouseEnter={handlePrepare}
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
              onClick={handleProject}
              onFocus={handlePrepare}
              onMouseEnter={handlePrepare}
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
              onClick={handleDelete}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Remove</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
})

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
