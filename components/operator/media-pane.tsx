"use client"

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
  type RefObject,
} from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Upload,
  Trash2,
  Radio,
  Eye,
  ImageOff,
  Image as ImageIcon,
  FolderPlus,
  FolderUp,
  FolderInput,
  Play,
  Film,
  ListFilter,
  ArrowDownUp,
  Check,
} from "lucide-react"
import type { Folder, MediaItem } from "./types"
import type { BackgroundTarget } from "@/lib/background-config"
import { resolveImageUrl } from "@/lib/image-store"
import { cn } from "@/lib/utils"
// Reuse the generic (note-agnostic) folder header + name dialog so the media
// folders look and behave exactly like the notes folders.
import { FolderHeader, FolderNameDialog } from "./note-folder-row"

const BACKGROUND_TARGETS: { value: BackgroundTarget; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "scripture", label: "Scripture" },
  { value: "song", label: "Songs" },
  { value: "note", label: "Notes" },
  { value: "definition", label: "Dictionary" },
]

const TILE_MIN_WIDTH = 180

type MediaFilter = "all" | "image" | "video"
type MediaSort = "date" | "name"

const FILTER_LABELS: Record<MediaFilter, string> = {
  all: "All",
  image: "Images",
  video: "Videos",
}

const SORT_LABELS: Record<MediaSort, string> = {
  date: "Date added",
  name: "Name",
}

interface MediaPaneProps {
  items: MediaItem[]
  folders: Folder[]
  onUpload: (file: File) => void
  // Add videos via the File System Access picker (handle-only, no byte copy).
  onAddVideos: () => void
  // No args → directory picker (when supported); Files → <input> fallback.
  onUploadFolder: (files?: File[]) => void
  onDelete: (id: string) => void
  onPreview: (item: MediaItem) => void
  onProject: (item: MediaItem) => void
  onPrepare: (item: MediaItem) => void
  onSetBackground: (item: MediaItem, target: BackgroundTarget) => void
  onCreateFolder: (name: string) => void
  onRenameFolder: (id: string, name: string) => void
  onDeleteFolder: (id: string) => void
  onMoveToFolder: (id: string, folderId: string | null) => void
  onMoveManyToFolder: (ids: string[], folderId: string | null) => void
}

// Modifier flags resolved from a tile click; drive the selection behaviour.
type SelectModifiers = { meta: boolean; shift: boolean }

export function MediaPane({
  items,
  folders,
  onUpload,
  onAddVideos,
  onUploadFolder,
  onDelete,
  onPreview,
  onProject,
  onPrepare,
  onSetBackground,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveToFolder,
  onMoveManyToFolder,
}: MediaPaneProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [createOpen, setCreateOpen] = useState(false)
  const [filter, setFilter] = useState<MediaFilter>("all")
  const [sort, setSort] = useState<MediaSort>("date")
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  // Multi-select: ids the user has selected so they can drag/move them together.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Latest selection, read lazily inside a tile's dragStart / context menu so the
  // tiles can stay memoized (no per-selection array prop fan-out).
  const selectionRef = useRef(selected)
  useEffect(() => {
    selectionRef.current = selected
  }, [selected])
  // Anchor for shift-range selection (last tile clicked without shift).
  const anchorRef = useRef<string | null>(null)
  // Videos require the File System Access picker (Chromium-only); detect support
  // client-side so the "Add video" affordance only shows where it can work.
  const [canPickFiles, setCanPickFiles] = useState(false)

  useEffect(() => {
    // The directory picker needs the non-standard `webkitdirectory` attribute,
    // which React doesn't type as a prop; set it imperatively.
    folderRef.current?.setAttribute("webkitdirectory", "")
    setCanPickFiles(typeof window !== "undefined" && typeof window.showOpenFilePicker === "function")
  }, [])

  // Images only: videos are added via the picker (handle-only). A dropped or
  // selected video has no handle to keep, so we skip it here.
  const handleFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach((file) => {
      if (file.type.startsWith("image/")) onUpload(file)
    })
  }

  const sortedFolders = useMemo(
    () => [...folders].sort((a, b) => a.name.localeCompare(b.name)),
    [folders],
  )

  // Apply the type filter, bucket items by folder (unknown/absent ids land in
  // Unfiled), then sort each bucket by the chosen order.
  const { byFolder, unfiled, visibleCount } = useMemo(() => {
    const known = new Set(folders.map((f) => f.id))
    const byFolder = new Map<string, MediaItem[]>()
    const unfiled: MediaItem[] = []
    let visibleCount = 0
    for (const item of items) {
      if (filter !== "all" && item.kind !== filter) continue
      visibleCount++
      if (item.folderId && known.has(item.folderId)) {
        const bucket = byFolder.get(item.folderId) ?? []
        bucket.push(item)
        byFolder.set(item.folderId, bucket)
      } else {
        unfiled.push(item)
      }
    }
    const comparator =
      sort === "name"
        ? (a: MediaItem, b: MediaItem) => a.name.localeCompare(b.name)
        : (a: MediaItem, b: MediaItem) => b.createdAt - a.createdAt
    byFolder.forEach((bucket) => bucket.sort(comparator))
    unfiled.sort(comparator)
    return { byFolder, unfiled, visibleCount }
  }, [items, folders, filter, sort])

  // The flat order tiles render in (folders top-to-bottom, then Unfiled). Shift
  // selection ranges run across this combined visible order.
  const orderedIds = useMemo(() => {
    const ids: string[] = []
    for (const folder of sortedFolders) {
      for (const item of byFolder.get(folder.id) ?? []) ids.push(item.id)
    }
    for (const item of unfiled) ids.push(item.id)
    return ids
  }, [sortedFolders, byFolder, unfiled])
  const orderedIdsRef = useRef(orderedIds)
  useEffect(() => {
    orderedIdsRef.current = orderedIds
  }, [orderedIds])

  const clearSelection = useCallback(() => setSelected(new Set()), [])

  // Cmd/Ctrl-click toggles one tile; Shift-click extends a range from the anchor;
  // a plain click clears the selection (the tile then runs its preview action).
  const handleSelect = useCallback((id: string, modifiers: SelectModifiers) => {
    if (modifiers.shift) {
      const order = orderedIdsRef.current
      const anchor = anchorRef.current
      const to = order.indexOf(id)
      const from = anchor ? order.indexOf(anchor) : -1
      if (to === -1 || from === -1) {
        setSelected(new Set([id]))
        anchorRef.current = id
        return
      }
      const [lo, hi] = from < to ? [from, to] : [to, from]
      setSelected(new Set(order.slice(lo, hi + 1)))
      return
    }
    if (modifiers.meta) {
      setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
      anchorRef.current = id
      return
    }
    anchorRef.current = id
    setSelected((prev) => (prev.size === 0 ? prev : new Set()))
  }, [])

  // Read lazily at drag/move time so tiles don't take the selection as a prop.
  const getSelectionIds = useCallback(() => Array.from(selectionRef.current), [])

  // Escape clears an active selection.
  useEffect(() => {
    if (selected.size === 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(new Set())
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selected.size])

  const toggleFolder = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Drop a dragged tile onto a folder group (folderId) or the Unfiled group
  // (null) to re-file it. `key` is just the highlight identity.
  const dropZone = (key: string, folderId: string | null) => ({
    onDragOver: (e: DragEvent) => {
      const types = e.dataTransfer.types
      if (
        !types.includes("application/x-media-ids") &&
        !types.includes("application/x-media-id")
      )
        return
      e.preventDefault()
      e.dataTransfer.dropEffect = "move"
      setDragOverKey(key)
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
        setDragOverKey((current) => (current === key ? null : current))
      }
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      setDragOverKey(null)
      // Prefer the multi payload (a JSON array of ids) when a 2+ selection was
      // dragged; otherwise fall back to the single-id payload.
      const many = e.dataTransfer.getData("application/x-media-ids")
      if (many) {
        try {
          const ids = JSON.parse(many) as string[]
          if (Array.isArray(ids) && ids.length > 0) {
            onMoveManyToFolder(ids, folderId)
            clearSelection()
            return
          }
        } catch {
          // malformed payload — fall through to the single-id path
        }
      }
      const id = e.dataTransfer.getData("application/x-media-id")
      if (id) {
        onMoveToFolder(id, folderId)
        clearSelection()
      }
    },
    "data-drop-active": dragOverKey === key ? "" : undefined,
  })

  const renderGrid = (bucket: MediaItem[]) => (
    <div
      className="grid gap-3 px-1 pb-1"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${TILE_MIN_WIDTH}px, 1fr))` }}
    >
      {bucket.map((item, index) => (
        <MediaTile
          key={item.id}
          item={item}
          index={index}
          folders={sortedFolders}
          selected={selected.has(item.id)}
          onSelect={handleSelect}
          getSelectionIds={getSelectionIds}
          onClearSelection={clearSelection}
          onDelete={onDelete}
          onPreview={onPreview}
          onProject={onProject}
          onPrepare={onPrepare}
          onSetBackground={onSetBackground}
          onMoveToFolder={onMoveToFolder}
          onMoveManyToFolder={onMoveManyToFolder}
        />
      ))}
    </div>
  )

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between gap-3 px-6 pt-6 pb-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium">Media library</h2>
          {selected.size > 0 ? (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {selected.size} selected ·{" "}
              <button
                onClick={clearSelection}
                className="text-foreground underline-offset-2 hover:underline"
              >
                Clear
              </button>
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {visibleCount} item{visibleCount === 1 ? "" : "s"} · click to preview, double-click to go live
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 text-xs">
                <ListFilter className="size-3.5 mr-1.5" />
                {FILTER_LABELS[filter]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">Show</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={filter}
                onValueChange={(value) => setFilter(value as MediaFilter)}
              >
                <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="image">Images</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="video">Videos</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 text-xs">
                <ArrowDownUp className="size-3.5 mr-1.5" />
                {SORT_LABELS[sort]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">Sort by</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={sort}
                onValueChange={(value) => setSort(value as MediaSort)}
              >
                <DropdownMenuRadioItem value="date">Date added</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setCreateOpen(true)}
                className="size-8 grid place-items-center rounded-md border border-border bg-background hover:bg-accent transition-colors"
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
                onClick={() => {
                  // Prefer the directory picker (yields handles, so videos stay
                  // handle-only); otherwise fall back to the <input> (images).
                  if (typeof window !== "undefined" && window.showDirectoryPicker) onUploadFolder()
                  else folderRef.current?.click()
                }}
                className="size-8 grid place-items-center rounded-md border border-border bg-background hover:bg-accent transition-colors"
                aria-label="Upload folder"
              >
                <FolderUp className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Upload folder</TooltipContent>
          </Tooltip>
          {canPickFiles && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => onAddVideos()}
            >
              <Film className="size-3.5 mr-1.5" />
              Video
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-3.5 mr-1.5" />
            Upload
          </Button>
        </div>
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
        <input
          ref={folderRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = e.target.files
            if (files && files.length > 0) onUploadFolder(Array.from(files))
            e.target.value = ""
          }}
        />
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {items.length === 0 && folders.length === 0 ? (
          <DropZone onFiles={handleFiles} onPick={() => fileRef.current?.click()} />
        ) : (
          <div className="p-6 pt-2 space-y-3">
            {sortedFolders.map((folder) => {
              const bucket = byFolder.get(folder.id) ?? []
              const isCollapsed = collapsed.has(folder.id)
              return (
                <div
                  key={folder.id}
                  {...dropZone(folder.id, folder.id)}
                  className="rounded-md transition-colors data-[drop-active]:bg-accent/60 data-[drop-active]:ring-1 data-[drop-active]:ring-foreground/20"
                >
                  <FolderHeader
                    folder={folder}
                    count={bucket.length}
                    collapsed={isCollapsed}
                    onToggle={() => toggleFolder(folder.id)}
                    onRename={onRenameFolder}
                    onDelete={onDeleteFolder}
                  />
                  {!isCollapsed &&
                    (bucket.length === 0 ? (
                      <p className="px-3 py-1.5 text-[11px] text-muted-foreground/60">Empty folder</p>
                    ) : (
                      renderGrid(bucket)
                    ))}
                </div>
              )
            })}

            <div
              {...dropZone("__unfiled__", null)}
              className="rounded-md transition-colors data-[drop-active]:bg-accent/60 data-[drop-active]:ring-1 data-[drop-active]:ring-foreground/20"
            >
              {sortedFolders.length > 0 && (
                <div className="px-3 py-1 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
                  Unfiled
                </div>
              )}
              {unfiled.length === 0
                ? sortedFolders.length > 0 && (
                    <p className="px-3 py-1.5 text-[11px] text-muted-foreground/60">No items</p>
                  )
                : renderGrid(unfiled)}
            </div>
          </div>
        )}
      </div>

      <FolderNameDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New folder"
        submitLabel="Create"
        onSubmit={onCreateFolder}
      />
    </div>
  )
}

// One shared IntersectionObserver drives every tile's "near viewport" state, so
// off-screen tiles never read IndexedDB or allocate object URLs until the user
// scrolls close. Each tile observes once and unobserves after it first appears.
let sharedObserver: IntersectionObserver | null = null
const observerCallbacks = new WeakMap<Element, () => void>()

function getSharedObserver(): IntersectionObserver | null {
  if (sharedObserver) return sharedObserver
  if (typeof IntersectionObserver === "undefined") return null
  sharedObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) observerCallbacks.get(entry.target)?.()
      }
    },
    { rootMargin: "300px" },
  )
  return sharedObserver
}

function useInViewport<T extends Element>(ref: RefObject<T | null>): boolean {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    if (inView) return
    const el = ref.current
    const observer = getSharedObserver()
    if (!el || !observer) {
      setInView(true) // no IO support — resolve eagerly so tiles still render
      return
    }
    observerCallbacks.set(el, () => setInView(true))
    observer.observe(el)
    return () => {
      observer.unobserve(el)
      observerCallbacks.delete(el)
    }
  }, [ref, inView])
  return inView
}

const MediaTile = memo(function MediaTile({
  item,
  index,
  folders,
  selected,
  onSelect,
  getSelectionIds,
  onClearSelection,
  onDelete,
  onPreview,
  onProject,
  onPrepare,
  onSetBackground,
  onMoveToFolder,
  onMoveManyToFolder,
}: {
  item: MediaItem
  index: number
  folders: Folder[]
  selected: boolean
  onSelect: (id: string, modifiers: SelectModifiers) => void
  getSelectionIds: () => string[]
  onClearSelection: () => void
  onDelete: (id: string) => void
  onPreview: (item: MediaItem) => void
  onProject: (item: MediaItem) => void
  onPrepare: (item: MediaItem) => void
  onSetBackground: (item: MediaItem, target: BackgroundTarget) => void
  onMoveToFolder: (id: string, folderId: string | null) => void
  onMoveManyToFolder: (ids: string[], folderId: string | null) => void
}) {
  const tileRef = useRef<HTMLDivElement>(null)
  const inView = useInViewport(tileRef)
  const [url, setUrl] = useState<string | null>(null)
  const isVideo = item.kind === "video"

  // Defer the IndexedDB read / object-URL allocation until the tile is near the
  // viewport. Videos render their captured poster (thumbnailId) just like images.
  useEffect(() => {
    if (!inView) return
    let cancelled = false
    resolveImageUrl(item.thumbnailId ?? item.imageId ?? item.dataUrl).then((u) => {
      if (!cancelled) setUrl(u)
    })
    return () => {
      cancelled = true
    }
  }, [inView, item.dataUrl, item.imageId, item.thumbnailId])

  const handleDelete = useCallback(() => onDelete(item.id), [item.id, onDelete])
  const handlePreview = useCallback(() => onPreview(item), [item, onPreview])
  const handleProject = useCallback(() => onProject(item), [item, onProject])
  const handlePrepare = useCallback(() => onPrepare(item), [item, onPrepare])

  // A modifier-click drives selection (no preview); a plain click clears the
  // selection and previews as before.
  const handleClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) {
        e.preventDefault()
        onSelect(item.id, { meta: e.metaKey || e.ctrlKey, shift: e.shiftKey })
        return
      }
      onSelect(item.id, { meta: false, shift: false })
      onPreview(item)
    },
    [item, onPreview, onSelect],
  )

  // Toggle this tile via the hover checkbox (acts like a Cmd/Ctrl-click).
  const handleToggle = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      onSelect(item.id, { meta: true, shift: false })
    },
    [item.id, onSelect],
  )

  // Move from the context menu: the whole selection when this tile is part of a
  // 2+ selection, otherwise just this tile.
  const handleMoveToFolder = useCallback(
    (folderId: string | null) => {
      const ids = getSelectionIds()
      if (selected && ids.length >= 2) {
        onMoveManyToFolder(ids, folderId)
        onClearSelection()
      } else {
        onMoveToFolder(item.id, folderId)
      }
    },
    [getSelectionIds, item.id, onClearSelection, onMoveManyToFolder, onMoveToFolder, selected],
  )

  return (
    <div
      ref={tileRef}
      draggable
      onDragStart={(e) => {
        // Carry the whole selection when this tile is part of a 2+ selection;
        // otherwise carry just this tile (back-compat single-id payload).
        const ids = getSelectionIds()
        if (selected && ids.length >= 2) {
          e.dataTransfer.setData("application/x-media-ids", JSON.stringify(ids))
        } else {
          e.dataTransfer.setData("application/x-media-id", item.id)
        }
        e.dataTransfer.effectAllowed = "move"
      }}
      className={cn(
        "group relative aspect-video rounded-md overflow-hidden border bg-card cursor-grab active:cursor-grabbing",
        selected
          ? "border-primary ring-2 ring-primary ring-offset-1 ring-offset-background"
          : "border-border",
      )}
      style={{ contentVisibility: "auto", containIntrinsicSize: "180px 101px" }}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            onClick={handleClick}
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
                draggable={false}
                fetchPriority={index < 24 ? "high" : "auto"}
                className="absolute inset-0 size-full object-cover transition-transform group-hover:scale-[1.02]"
              />
            ) : (
              <span className="absolute inset-0 grid place-items-center text-muted-foreground">
                {isVideo ? <Film className="size-4" /> : <ImageOff className="size-4" />}
              </span>
            )}
            {isVideo && (
              <span
                aria-hidden
                className="absolute inset-0 grid place-items-center pointer-events-none"
              >
                <span className="size-9 rounded-full bg-black/55 grid place-items-center">
                  <Play className="size-4 text-white fill-white" />
                </span>
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
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <FolderInput className="size-3.5" />
              Move to folder
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuRadioGroup
                value={item.folderId ?? ""}
                onValueChange={(value) => handleMoveToFolder(value === "" ? null : value)}
              >
                <ContextMenuRadioItem value="">Unfiled</ContextMenuRadioItem>
                {folders.map((folder) => (
                  <ContextMenuRadioItem key={folder.id} value={folder.id}>
                    <span className="truncate">{folder.name}</span>
                  </ContextMenuRadioItem>
                ))}
              </ContextMenuRadioGroup>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onSelect={handleDelete}>
            <Trash2 className="size-3.5" />
            Remove
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <button
        type="button"
        onClick={handleToggle}
        aria-label={selected ? `Deselect ${item.name}` : `Select ${item.name}`}
        aria-pressed={selected}
        className={cn(
          "absolute top-1.5 left-1.5 z-10 size-5 rounded-full grid place-items-center transition-opacity",
          selected
            ? "bg-primary text-primary-foreground opacity-100"
            : "bg-black/55 text-white ring-1 ring-white/60 opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
        )}
      >
        {selected && <Check className="size-3" />}
      </button>

      <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 bg-gradient-to-t from-black/70 via-black/30 to-transparent flex items-end justify-between gap-2">
        <span className="text-[11px] text-white truncate font-mono">{item.name}</span>
        {isVideo && <Film className="size-3 text-white/80 shrink-0" />}
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
      <p className="text-sm font-medium">Drop images or videos here</p>
      <p className="text-xs text-muted-foreground mt-1 mb-4">PNG, JPG, GIF, MP4 — any aspect ratio</p>
      <Button size="sm" variant="outline" onClick={onPick}>
        <Upload className="size-3.5 mr-1.5" />
        Or browse files
      </Button>
    </div>
  )
}
