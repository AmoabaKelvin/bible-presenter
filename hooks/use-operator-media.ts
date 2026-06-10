"use client"

import { useCallback, type Dispatch, type SetStateAction } from "react"
import type { SelectedVerse } from "@/components/slide-stage"
import type { MediaItem } from "@/components/operator/types"
import type { BackgroundTarget } from "@/lib/background-config"
import { resolveImageUrl } from "@/lib/image-store"
import { useMediaLibrary } from "@/hooks/use-media-library"
import { useOperatorBackground } from "@/hooks/use-operator-background"

type MediaSlide = { id: string; url: string } | null

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
  const { media, handleMediaUpload, deleteMedia, ensureStoredMediaItem } = useMediaLibrary()
  const background = useOperatorBackground()

  const handlePreviewMedia = useCallback(
    async (item: MediaItem) => {
      const storedItem = await ensureStoredMediaItem(item)
      const ref = storedItem.imageId ?? storedItem.dataUrl ?? ""
      const url = await resolveImageUrl(ref)
      if (!url) return
      setPreviewVerses([])
      setPreviewMedia({ id: ref, url })
    },
    [ensureStoredMediaItem, setPreviewMedia, setPreviewVerses],
  )

  const handleProjectMedia = useCallback(
    async (item: MediaItem) => {
      const storedItem = await ensureStoredMediaItem(item)
      const ref = storedItem.imageId ?? storedItem.dataUrl ?? ""
      const url = await resolveImageUrl(ref)
      if (!url) return
      setPreviewVerses([])
      setLiveVerses([])
      setPreviewMedia({ id: ref, url })
      setLiveMedia({ id: ref, url })
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
    background,
    themeLoaded: background.themeLoaded,
    handleMediaUpload,
    deleteMedia,
    handlePreviewMedia,
    handleProjectMedia,
    prepareMedia,
    setMediaAsBackground,
  }
}
