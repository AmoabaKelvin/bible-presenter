"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Folder, MediaItem } from "@/components/operator/types"
import {
  dataUrlToBlob,
  getStoredImageBlob,
  removeImage,
  storeImage,
  storeImageThumbnail,
  storeVideoPoster,
} from "@/lib/image-store"
import { removeFileHandle, storeFileHandle } from "@/lib/file-handle-store"
import { newId } from "@/lib/note-slides"
import { readLegacyJson, readPersisted, writePersisted } from "@/lib/persistence"

const MEDIA_KEY = "biblePresenterMedia"
const MEDIA_FOLDERS_KEY = "mediaFolders"

// Media persisted before videos/folders existed lacks `kind`; treat it as an
// image (everything in the library was an image then) and leave folderId unset.
type StoredMediaItem = Omit<MediaItem, "kind"> & { kind?: MediaItem["kind"] }

// Flatten a picked directory (and its subdirectories) into a list of file
// handles. Media folders are one level, so nested files all land in the one
// folder we create for the picked directory.
async function collectFileHandles(
  dir: FileSystemDirectoryHandle,
  out: FileSystemFileHandle[],
): Promise<void> {
  if (typeof dir.values !== "function") return
  for await (const entry of dir.values()) {
    if (entry.kind === "file") out.push(entry)
    else await collectFileHandles(entry, out)
  }
}

export function useMediaLibrary() {
  const [loaded, setLoaded] = useState(false)
  const [media, setMedia] = useState<MediaItem[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const skipNextPersistRef = useRef(false)

  const migrateMediaItem = useCallback(async (item: MediaItem): Promise<MediaItem> => {
    let imageId = item.imageId
    let thumbnailId = item.thumbnailId
    let sourceBlob: Blob | undefined

    if (!imageId && item.dataUrl) {
      sourceBlob = await dataUrlToBlob(item.dataUrl)
      imageId = await storeImage(sourceBlob)
    }

    if (imageId && !thumbnailId) {
      sourceBlob = sourceBlob ?? (await getStoredImageBlob(imageId))
      if (sourceBlob?.type.startsWith("image/")) {
        thumbnailId = (await storeImageThumbnail(sourceBlob)) ?? undefined
      }
    }

    if (imageId || thumbnailId) {
      return {
        ...item,
        imageId,
        thumbnailId,
        dataUrl: imageId ? undefined : item.dataUrl,
      }
    }

    return item
  }, [])

  const migrateMediaItems = useCallback(
    async (items: MediaItem[]) => {
      const candidates = items.filter((item) => item.dataUrl)
      if (candidates.length === 0) return

      const migrated = new Map<string, MediaItem>()
      for (const item of candidates) {
        try {
          const next = await migrateMediaItem(item)
          if (
            next.imageId !== item.imageId ||
            next.thumbnailId !== item.thumbnailId ||
            next.dataUrl !== item.dataUrl
          ) {
            migrated.set(item.id, next)
          }
        } catch (err) {
          console.error("FlowCast: failed to migrate media item", err)
        }
      }

      if (migrated.size === 0) return
      setMedia((current) =>
        current.map((item) => {
          const next = migrated.get(item.id)
          return next ? { ...item, ...next } : item
        }),
      )
    },
    [migrateMediaItem],
  )

  useEffect(() => {
    try {
      const stored = readPersisted<StoredMediaItem[]>("media", {
        legacy: { keys: [MEDIA_KEY], read: () => readLegacyJson<StoredMediaItem[]>(MEDIA_KEY) },
      })
      if (stored) {
        const parsed: MediaItem[] = stored.map((item) => ({ ...item, kind: item.kind ?? "image" }))
        skipNextPersistRef.current = true
        setMedia(parsed)
        void migrateMediaItems(parsed)
      }
      const storedFolders = readPersisted<Folder[]>(MEDIA_FOLDERS_KEY)
      if (Array.isArray(storedFolders)) setFolders(storedFolders)
    } catch {
      // ignore corrupt local state
    }
    setLoaded(true)
  }, [migrateMediaItems])

  useEffect(() => {
    if (!loaded) return
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false
      return
    }
    writePersisted("media", media)
  }, [media, loaded])

  useEffect(() => {
    if (!loaded) return
    writePersisted(MEDIA_FOLDERS_KEY, folders)
  }, [folders, loaded])

  // Image-only now: videos are added via addVideos (handle-only, no byte copy).
  // The directory-input fallback can still deliver a video File — skip it rather
  // than copying its bytes into IndexedDB. Returns the new item's id so callers
  // (e.g. folder upload) can track it.
  const handleMediaUpload = useCallback(async (file: File, folderId?: string) => {
    if (file.type.startsWith("video/")) return null
    try {
      const imageId = await storeImage(file)
      const thumbnailId = (await storeImageThumbnail(file)) ?? undefined
      const id = `media-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setMedia((items) => [
        {
          id,
          name: file.name,
          kind: "image",
          imageId,
          thumbnailId,
          createdAt: Date.now(),
          folderId,
        },
        ...items,
      ])
      return id
    } catch (err) {
      console.error("FlowCast: failed to store media", err)
      return null
    }
  }, [])

  // Add a video from a File System Access handle: capture a poster image (the
  // only bytes persisted) and store the handle itself — never the video bytes.
  const addVideoFromHandle = useCallback(
    async (handle: FileSystemFileHandle, folderId?: string) => {
      try {
        const file = await handle.getFile()
        const thumbnailId = (await storeVideoPoster(file)) ?? undefined
        const handleId = await storeFileHandle(handle)
        const id = `media-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        setMedia((items) => [
          { id, name: file.name, kind: "video", handleId, thumbnailId, createdAt: Date.now(), folderId },
          ...items,
        ])
        return id
      } catch (err) {
        console.error("FlowCast: failed to add video", err)
        return null
      }
    },
    [],
  )

  // Pick one or more videos via the File System Access picker. Each picked file
  // is referenced by handle only; its bytes are never copied into storage.
  const addVideos = useCallback(
    async (folderId?: string) => {
      if (typeof window === "undefined" || !window.showOpenFilePicker) return
      let handles: FileSystemFileHandle[]
      try {
        handles = await window.showOpenFilePicker({
          multiple: true,
          types: [
            {
              description: "Video",
              accept: { "video/*": [".mp4", ".webm", ".mov", ".m4v", ".ogg"] },
            },
          ],
        })
      } catch {
        return // user cancelled or picker unavailable
      }
      for (const handle of handles) await addVideoFromHandle(handle, folderId)
    },
    [addVideoFromHandle],
  )

  const deleteMedia = useCallback(
    (id: string) => {
      const item = media.find((candidate) => candidate.id === id)
      if (item?.imageId) removeImage(item.imageId)
      if (item?.thumbnailId) removeImage(item.thumbnailId)
      if (item?.handleId) removeFileHandle(item.handleId)
      setMedia((items) => items.filter((candidate) => candidate.id !== id))
    },
    [media],
  )

  const ensureStoredMediaItem = useCallback(
    async (item: MediaItem) => {
      if (item.imageId && item.thumbnailId && !item.dataUrl) return item
      if (item.imageId && !item.dataUrl) {
        void migrateMediaItem(item)
          .then((next) => {
            if (next.thumbnailId === item.thumbnailId) return
            setMedia((items) =>
              items.map((candidate) =>
                candidate.id === item.id ? { ...candidate, ...next } : candidate,
              ),
            )
          })
          .catch((err) => console.error("FlowCast: failed to prepare media thumbnail", err))
        return item
      }

      const next = await migrateMediaItem(item)
      if (
        next.imageId !== item.imageId ||
        next.thumbnailId !== item.thumbnailId ||
        next.dataUrl !== item.dataUrl
      ) {
        setMedia((items) =>
          items.map((candidate) => (candidate.id === item.id ? { ...candidate, ...next } : candidate)),
        )
      }
      return next
    },
    [migrateMediaItem],
  )

  // Create a folder and return its id so an upload flow can file items into it
  // immediately (state updates are async, but the id is generated up front).
  const createMediaFolder = useCallback((name: string): string | null => {
    const trimmed = name.trim()
    if (!trimmed) return null
    const folder: Folder = { id: newId("media-folder"), name: trimmed, createdAt: Date.now() }
    setFolders((prev) => [...prev, folder])
    return folder.id
  }, [])

  const renameMediaFolder = useCallback((id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name: trimmed } : f)))
  }, [])

  // Removing a folder re-files its items to Unfiled rather than deleting them.
  const deleteMediaFolder = useCallback((id: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== id))
    setMedia((prev) =>
      prev.map((item) => (item.folderId === id ? { ...item, folderId: undefined } : item)),
    )
  }, [])

  const moveMediaToFolder = useCallback((itemId: string, folderId: string | null) => {
    setMedia((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, folderId: folderId ?? undefined } : item,
      ),
    )
  }, [])

  // Re-file many items at once in a single setMedia pass (one re-render) so a
  // multi-select drag/move doesn't thrash through moveMediaToFolder per item.
  const moveManyToFolder = useCallback((ids: string[], folderId: string | null) => {
    const idSet = new Set(ids)
    setMedia((prev) =>
      prev.map((item) =>
        idSet.has(item.id) ? { ...item, folderId: folderId ?? undefined } : item,
      ),
    )
  }, [])

  // Upload an entire directory: create a folder named after it and file every
  // image/video under it. Prefer the directory picker (it yields handles, so
  // videos are stored handle-only with a captured poster); otherwise fall back
  // to the <input webkitdirectory> Files, which can only deliver image bytes
  // (videos arriving that way are skipped — we never copy video bytes).
  const uploadMediaFolder = useCallback(
    async (files?: File[]) => {
      if ((!files || files.length === 0) && typeof window !== "undefined" && window.showDirectoryPicker) {
        let dir: FileSystemDirectoryHandle
        try {
          dir = await window.showDirectoryPicker()
        } catch {
          return // cancelled
        }
        const handles: FileSystemFileHandle[] = []
        await collectFileHandles(dir, handles)
        if (handles.length === 0) return
        const folderId = createMediaFolder(dir.name || "Uploaded folder")
        if (!folderId) return
        for (const handle of handles) {
          let file: File
          try {
            file = await handle.getFile()
          } catch {
            continue
          }
          if (file.type.startsWith("video/")) await addVideoFromHandle(handle, folderId)
          else if (file.type.startsWith("image/")) await handleMediaUpload(file, folderId)
        }
        return
      }

      // Fallback: images only. `webkitRelativePath` carries the directory name.
      if (!files) return
      const accepted = files.filter((file) => file.type.startsWith("image/"))
      if (accepted.length === 0) return
      const relativePath = accepted[0].webkitRelativePath ?? ""
      const folderName = relativePath.split("/")[0] || "Uploaded folder"
      const folderId = createMediaFolder(folderName)
      if (!folderId) return
      for (const file of accepted) {
        await handleMediaUpload(file, folderId)
      }
    },
    [addVideoFromHandle, createMediaFolder, handleMediaUpload],
  )

  return {
    media,
    folders,
    handleMediaUpload,
    addVideos,
    deleteMedia,
    ensureStoredMediaItem,
    createMediaFolder,
    renameMediaFolder,
    deleteMediaFolder,
    moveMediaToFolder,
    moveManyToFolder,
    uploadMediaFolder,
  }
}
