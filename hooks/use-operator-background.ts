"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  resolveBackgroundMedia,
  resolveImageUrl,
  storeImage,
  type BackgroundMediaKind,
} from "@/lib/image-store"
import {
  DEFAULT_BACKGROUND_LAYER,
  normalizeBackgroundConfig,
  resolveLayer,
  type BackgroundConfig,
  type BackgroundLayer,
  type BackgroundTarget,
} from "@/lib/background-config"
import type { SlideKind } from "@/components/slide-stage"
import {
  readLegacyString,
  readPersisted,
  removePersisted,
  writePersisted,
} from "@/lib/persistence"

const BG_COLOR_KEY = "biblePresenterBackgroundColor"
const BG_IMAGE_KEY = "biblePresenterBackgroundImage"
const BG_KIND_KEY = "biblePresenterBackgroundKind"

// Resolved object URL + kind for one layer, ready to render.
export type ResolvedBackground = {
  color: string
  url: string | null
  kind: BackgroundMediaKind | null
}

const PER_TYPE_TARGETS: BackgroundTarget[] = ["scripture", "song", "note", "definition"]

export function useOperatorBackground() {
  const [themeLoaded, setThemeLoaded] = useState(false)
  const [config, setConfig] = useState<BackgroundConfig>(() => ({
    default: { ...DEFAULT_BACKGROUND_LAYER },
  }))
  // Resolved object URLs keyed by background imageId, so every layer that
  // points at an image can render. Re-derived as layers change.
  const [urlById, setUrlById] = useState<Record<string, string>>({})

  useEffect(() => {
    try {
      const stored = readPersisted<unknown>("background", {
        legacy: {
          keys: [BG_COLOR_KEY, BG_IMAGE_KEY, BG_KIND_KEY],
          read: () => {
            const color = readLegacyString(BG_COLOR_KEY) ?? "#000000"
            const imageId = readLegacyString(BG_IMAGE_KEY)
            const kind = readLegacyString(BG_KIND_KEY)
            return {
              color,
              imageId,
              kind: kind === "image" || kind === "video" ? kind : null,
            }
          },
        },
      })
      setConfig(normalizeBackgroundConfig(stored))
    } catch {
      // ignore corrupt local state
    }
    setThemeLoaded(true)
  }, [])

  useEffect(() => {
    if (!themeLoaded) return
    try {
      writePersisted<BackgroundConfig>("background", config)
    } catch (err) {
      console.error("FlowCast: failed to persist background", err)
    }
  }, [config, themeLoaded])

  // Resolve every distinct imageId across all layers to an object URL.
  useEffect(() => {
    const ids = new Set<string>()
    const collect = (layer?: BackgroundLayer | null) => {
      if (layer?.imageId) ids.add(layer.imageId)
    }
    collect(config.default)
    PER_TYPE_TARGETS.forEach((target) => collect(config[target]))

    let cancelled = false
    Promise.all(
      Array.from(ids).map(async (id) => [id, await resolveImageUrl(id)] as const),
    ).then((entries) => {
      if (cancelled) return
      const next: Record<string, string> = {}
      for (const [id, url] of entries) {
        if (url) next[id] = url
      }
      setUrlById(next)
    })
    return () => {
      cancelled = true
    }
  }, [config])

  const resolveTarget = useCallback(
    (kind: SlideKind | undefined): ResolvedBackground => {
      const layer = resolveLayer(config, kind)
      return {
        color: layer.color,
        url: layer.imageId ? (urlById[layer.imageId] ?? null) : null,
        kind: layer.imageId ? layer.kind : null,
      }
    },
    [config, urlById],
  )

  // Resolved view of one layer for the controls. `overridden` is false for a
  // per-type slot that's inheriting the default (so the UI can show that).
  const resolveTargetLayer = useCallback(
    (target: BackgroundTarget): ResolvedBackground & { overridden: boolean } => {
      const layer = target === "default" ? config.default : config[target]
      const overridden = target === "default" || !!layer
      const effective = layer ?? config.default
      return {
        color: effective.color,
        url: effective.imageId ? (urlById[effective.imageId] ?? null) : null,
        kind: effective.imageId ? effective.kind : null,
        overridden,
      }
    },
    [config, urlById],
  )

  // Set the color of one layer (clears that layer's image, mirroring the old
  // single-background behavior where picking a color removed the image).
  const setLayerColor = useCallback((target: BackgroundTarget, color: string) => {
    setConfig((current) => ({
      ...current,
      [target]: { color, imageId: null, kind: null },
    }))
  }, [])

  // Upload an image/video and assign it to one layer.
  const uploadLayerImage = useCallback(
    async (target: BackgroundTarget, file: File) => {
      try {
        const id = await storeImage(file)
        const url = await resolveImageUrl(id)
        const kind: BackgroundMediaKind = file.type.startsWith("video/") ? "video" : "image"
        if (url) setUrlById((prev) => ({ ...prev, [id]: url }))
        setConfig((current) => {
          const prevColor = (target === "default" ? current.default : current[target])?.color
          return {
            ...current,
            [target]: { color: prevColor ?? "#000000", imageId: id, kind },
          }
        })
      } catch (err) {
        console.error("FlowCast: failed to store background", err)
      }
    },
    [],
  )

  // Assign an already-stored image (e.g. a media-library item) to one layer.
  const setLayerImage = useCallback(async (target: BackgroundTarget, imageId: string) => {
    const media = await resolveBackgroundMedia(imageId)
    if (media) setUrlById((prev) => ({ ...prev, [imageId]: media.url }))
    setConfig((current) => {
      const prevColor = (target === "default" ? current.default : current[target])?.color
      return {
        ...current,
        [target]: { color: prevColor ?? "#000000", imageId, kind: media?.kind ?? "image" },
      }
    })
  }, [])

  // Clear just the image of one layer (keeps its color).
  const clearLayerImage = useCallback((target: BackgroundTarget) => {
    setConfig((current) => {
      const layer = target === "default" ? current.default : current[target]
      return {
        ...current,
        [target]: { color: layer?.color ?? "#000000", imageId: null, kind: null },
      }
    })
  }, [])

  // Reset a per-type override back to inheriting the default. For "default"
  // this restores the black default layer.
  const resetLayer = useCallback((target: BackgroundTarget) => {
    setConfig((current) => {
      if (target === "default") {
        return { ...current, default: { ...DEFAULT_BACKGROUND_LAYER } }
      }
      const next = { ...current }
      delete next[target]
      return next
    })
  }, [])

  const resetAllBackgrounds = useCallback(() => {
    setConfig({ default: { ...DEFAULT_BACKGROUND_LAYER } })
    removePersisted("background")
  }, [])

  // Replace the entire config at once (used to restore a saved show). The
  // persist effect saves it and the url-resolution effect re-resolves every
  // layer's object URL. Normalize defensively so partial input can't break it.
  const replaceConfig = useCallback((next: BackgroundConfig) => {
    setConfig(normalizeBackgroundConfig(next))
  }, [])

  // A resolved view of every target, recomputed when layers/urls change. The
  // popover renders one section per target from this.
  const resolvedTargets = useMemo(
    () => ({
      default: resolveTargetLayer("default"),
      scripture: resolveTargetLayer("scripture"),
      song: resolveTargetLayer("song"),
      note: resolveTargetLayer("note"),
      definition: resolveTargetLayer("definition"),
    }),
    [resolveTargetLayer],
  )

  return {
    config,
    resolvedTargets,
    themeLoaded,
    resolveTarget,
    setLayerColor,
    uploadLayerImage,
    setLayerImage,
    clearLayerImage,
    resetLayer,
    resetAllBackgrounds,
    replaceConfig,
  }
}
