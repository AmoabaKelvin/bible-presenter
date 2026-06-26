"use client"

import { useCallback, type Dispatch, type SetStateAction } from "react"
import type { SelectedVerse } from "@/components/slide-stage"
import type { MediaItem } from "@/components/operator/types"
import type { BackgroundTarget } from "@/lib/background-config"
import { resolveImageUrl, resolveProjectedMedia } from "@/lib/image-store"
import { useMediaLibrary } from "@/hooks/use-media-library"
import { useOperatorBackground } from "@/hooks/use-operator-background"

type MediaSlide = { id: string; url: string; kind: "image" | "video" } | null

type UseOperatorMediaOptions = {
  setPreviewVerses: Dispatch<SetStateAction<SelectedVerse[]>>
  setLiveVerses: Dispatch<SetStateAction<SelectedVerse[]>>
  setPreviewMedia: Dispatch<SetStateAction<MediaSlide>>
  setLiveMedia: Dispatch<SetStateAction<MediaSlide>>
  writeToOutput: (payload: { verses?: SelectedVerse[]; mediaId?: string | null }) => void
}

export function useOperatorMedia({
  setPreviewVerses,
  setLiveVerses,
  setPreviewMedia,
  setLiveMedia,
  writeToOutput,
}: UseOperatorMediaOptions) {
  const {
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
  } = useMediaLibrary()
  const background = useOperatorBackground()

  const handlePreviewMedia = useCallback(
    async (item: MediaItem) => {
      // Videos resolve through their File System Access handle (request reads
      // here — the click is a user gesture). Images keep the blob/id path.
      if (item.kind === "video") {
        const ref = item.handleId ?? ""
        if (!ref) return
        const resolved = await resolveProjectedMedia(ref, { request: true })
        if (!resolved || "needsPermission" in resolved) return
        setPreviewVerses([])
        setPreviewMedia({ id: ref, url: resolved.url, kind: resolved.kind })
        return
      }
      const storedItem = await ensureStoredMediaItem(item)
      const ref = storedItem.imageId ?? storedItem.dataUrl ?? ""
      const url = await resolveImageUrl(ref)
      if (!url) return
      setPreviewVerses([])
      setPreviewMedia({ id: ref, url, kind: "image" })
    },
    [ensureStoredMediaItem, setPreviewMedia, setPreviewVerses],
  )

  const handleProjectMedia = useCallback(
    async (item: MediaItem) => {
      if (item.kind === "video") {
        const ref = item.handleId ?? ""
        if (!ref) return
        const resolved = await resolveProjectedMedia(ref, { request: true })
        if (!resolved || "needsPermission" in resolved) return
        setPreviewVerses([])
        setLiveVerses([])
        setPreviewMedia({ id: ref, url: resolved.url, kind: resolved.kind })
        setLiveMedia({ id: ref, url: resolved.url, kind: resolved.kind })
        writeToOutput({ mediaId: ref })
        return
      }
      const storedItem = await ensureStoredMediaItem(item)
      const ref = storedItem.imageId ?? storedItem.dataUrl ?? ""
      const url = await resolveImageUrl(ref)
      if (!url) return
      setPreviewVerses([])
      setLiveVerses([])
      setPreviewMedia({ id: ref, url, kind: "image" })
      setLiveMedia({ id: ref, url, kind: "image" })
      writeToOutput({ mediaId: ref })
    },
    [
      ensureStoredMediaItem,
      setLiveMedia,
      setLiveVerses,
      setPreviewMedia,
      setPreviewVerses,
      writeToOutput,
    ],
  )

  const prepareMedia = useCallback(
    async (item: MediaItem) => {
      // Warm the object-URL cache without prompting (no gesture on hover/focus);
      // a video only resolves here if read permission was already granted.
      if (item.kind === "video") {
        if (item.handleId) await resolveProjectedMedia(item.handleId, { request: false })
        return
      }
      const storedItem = await ensureStoredMediaItem(item)
      const ref = storedItem.imageId ?? storedItem.dataUrl ?? ""
      if (ref) await resolveImageUrl(ref)
    },
    [ensureStoredMediaItem],
  )

  // Use a media-library item as a layer's background. Mirrors handlePreviewMedia:
  // ensure the item has a durable IndexedDB id before pinning it.
  const setMediaAsBackground = useCallback(
    async (item: MediaItem, target: BackgroundTarget) => {
      const storedItem = await ensureStoredMediaItem(item)
      const ref = storedItem.imageId ?? storedItem.dataUrl ?? ""
      if (!ref) return
      await background.setLayerImage(target, ref)
    },
    [background, ensureStoredMediaItem],
  )

  return {
    media,
    folders,
    background,
    themeLoaded: background.themeLoaded,
    handleMediaUpload,
    addVideos,
    deleteMedia,
    handlePreviewMedia,
    handleProjectMedia,
    prepareMedia,
    setMediaAsBackground,
    createMediaFolder,
    renameMediaFolder,
    deleteMediaFolder,
    moveMediaToFolder,
    moveManyToFolder,
    uploadMediaFolder,
  }
}
