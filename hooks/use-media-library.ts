"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { MediaItem } from "@/components/operator/types"
import {
  dataUrlToBlob,
  getStoredImageBlob,
  removeImage,
  storeImage,
  storeImageThumbnail,
} from "@/lib/image-store"
import { readLegacyJson, readPersisted, writePersisted } from "@/lib/persistence"

const MEDIA_KEY = "biblePresenterMedia"

export function useMediaLibrary() {
  const [loaded, setLoaded] = useState(false)
  const [media, setMedia] = useState<MediaItem[]>([])
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
      const stored = readPersisted<MediaItem[]>("media", {
        legacy: { keys: [MEDIA_KEY], read: () => readLegacyJson<MediaItem[]>(MEDIA_KEY) },
      })
      if (stored) {
        const parsed = stored
        skipNextPersistRef.current = true
        setMedia(parsed)
        void migrateMediaItems(parsed)
      }
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

  const handleMediaUpload = useCallback(async (file: File) => {
    try {
      const imageId = await storeImage(file)
      const thumbnailId = (await storeImageThumbnail(file)) ?? undefined
      setMedia((items) => [
        {
          id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          imageId,
          thumbnailId,
          createdAt: Date.now(),
        },
        ...items,
      ])
    } catch (err) {
      console.error("FlowCast: failed to store media", err)
    }
  }, [])

  const deleteMedia = useCallback(
    (id: string) => {
      const item = media.find((candidate) => candidate.id === id)
      if (item?.imageId) removeImage(item.imageId)
      if (item?.thumbnailId) removeImage(item.thumbnailId)
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

  return {
    media,
    handleMediaUpload,
    deleteMedia,
    ensureStoredMediaItem,
  }
}
