"use client"

import { useCallback, type Dispatch, type SetStateAction } from "react"
import type { SelectedVerse } from "@/components/slide-stage"
import type { MediaItem } from "@/components/operator/types"
import { resolveImageUrl, type BackgroundMediaKind } from "@/lib/image-store"
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

type UseOperatorMediaResult = {
  media: MediaItem[]
  backgroundColor: string
  setBackgroundColor: (color: string) => void
  backgroundImageUrl: string | null
  backgroundKind: BackgroundMediaKind | null
  themeLoaded: boolean
  handleMediaUpload: (file: File) => Promise<void>
  deleteMedia: (id: string) => void
  handlePreviewMedia: (item: MediaItem) => Promise<void>
  handleProjectMedia: (item: MediaItem) => Promise<void>
  prepareMedia: (item: MediaItem) => Promise<void>
  handleBackgroundUpload: (file: File) => Promise<void>
  clearBackgroundImage: () => void
  resetBackground: () => void
}

export function useOperatorMedia({
  setPreviewVerses,
  setLiveVerses,
  setPreviewMedia,
  setLiveMedia,
  writeToOutput,
}: UseOperatorMediaOptions): UseOperatorMediaResult {
  const { media, handleMediaUpload, deleteMedia, ensureStoredMediaItem } = useMediaLibrary()
  const {
    backgroundColor,
    setBackgroundColor,
    backgroundImageUrl,
    backgroundKind,
    themeLoaded,
    handleBackgroundUpload,
    clearBackgroundImage,
    resetBackground,
  } = useOperatorBackground()

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

  return {
    media,
    backgroundColor,
    setBackgroundColor,
    backgroundImageUrl,
    backgroundKind,
    themeLoaded,
    handleMediaUpload,
    deleteMedia,
    handlePreviewMedia,
    handleProjectMedia,
    prepareMedia,
    handleBackgroundUpload,
    clearBackgroundImage,
    resetBackground,
  }
}
