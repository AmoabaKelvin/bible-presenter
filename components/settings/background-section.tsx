"use client"

import { useRef, useState } from "react"
import { HexColorPicker } from "react-colorful"
import { Pipette, Upload, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  DEFAULT_BACKGROUND_LAYER,
  type BackgroundConfig,
  type BackgroundLayer,
  type BackgroundTarget,
} from "@/lib/background-config"
import {
  BACKGROUND_BLUR_BOUNDS,
  BACKGROUND_DIM_BOUNDS,
  DEFAULT_PRESENTATION,
  type PresentationSettings,
} from "@/lib/presentation-settings"
import { resolveImageUrl, storeImage } from "@/lib/image-store"
import {
  Segmented,
  SettingRow,
  SettingsGroupLabel,
  SettingsSection,
  SliderField,
  Toggle,
} from "./settings-controls"

const COLOR_PRESETS = [
  { value: "#000000", label: "Black" },
  { value: "#ffffff", label: "White" },
  { value: "#0f172a", label: "Slate" },
  { value: "#1c1917", label: "Stone" },
  { value: "#1e3a5f", label: "Navy" },
  { value: "#1b4332", label: "Forest" },
  { value: "#3d0c02", label: "Maroon" },
  { value: "#2d1b4e", label: "Plum" },
]

const TARGETS: { value: BackgroundTarget; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "scripture", label: "Scripture" },
  { value: "song", label: "Songs" },
  { value: "note", label: "Notes" },
  { value: "definition", label: "Dictionary" },
]

interface BackgroundSectionProps {
  config: BackgroundConfig
  onConfigChange: (config: BackgroundConfig) => void
  // Object URLs for every imageId in the draft config.
  urls: Record<string, string>
  onUrlResolved: (id: string, url: string) => void
  presentation: PresentationSettings
  onPresentationChange: (patch: Partial<PresentationSettings>) => void
  // Lets the preview follow the target being edited.
  target: BackgroundTarget
  onTargetChange: (target: BackgroundTarget) => void
}

export function BackgroundSection({
  config,
  onConfigChange,
  urls,
  onUrlResolved,
  presentation,
  onPresentationChange,
  target,
  onTargetChange,
}: BackgroundSectionProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const own = target === "default" ? config.default : config[target]
  const inherits = target !== "default" && !own
  const layer: BackgroundLayer = own ?? config.default
  const url = layer.imageId ? urls[layer.imageId] : undefined

  const setLayer = (next: BackgroundLayer) => onConfigChange({ ...config, [target]: next })

  const setInherit = (inherit: boolean) => {
    if (target === "default") return
    if (inherit) {
      const next = { ...config }
      delete next[target]
      onConfigChange(next)
    } else {
      // Start the override from what's showing now so nothing jumps.
      setLayer({ ...config.default })
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setUploading(true)
    try {
      const id = await storeImage(file)
      const resolved = await resolveImageUrl(id)
      if (resolved) onUrlResolved(id, resolved)
      setLayer({
        color: layer.color,
        imageId: id,
        kind: file.type.startsWith("video/") ? "video" : "image",
      })
    } catch (err) {
      console.error("FlowCast: failed to store background", err)
    } finally {
      setUploading(false)
    }
  }

  const { backgroundBlur: blur, backgroundDim: dim } = presentation
  const effectsAtDefault =
    blur === DEFAULT_PRESENTATION.backgroundBlur && dim === DEFAULT_PRESENTATION.backgroundDim
  const resetAll = () => {
    onConfigChange({ default: { ...DEFAULT_BACKGROUND_LAYER } })
    onPresentationChange({
      backgroundBlur: DEFAULT_PRESENTATION.backgroundBlur,
      backgroundDim: DEFAULT_PRESENTATION.backgroundDim,
    })
  }
  const configAtDefault =
    !config.scripture &&
    !config.song &&
    !config.note &&
    !config.definition &&
    config.default.imageId === null &&
    config.default.color.toLowerCase() === DEFAULT_BACKGROUND_LAYER.color

  return (
    <SettingsSection
      title="Background"
      description="One default background sits behind every slide. Scripture, songs, notes, and dictionary slides can each use their own instead."
      onReset={resetAll}
      resetDisabled={configAtDefault && effectsAtDefault}
    >
      <div className="py-5">
        <Segmented label="Slide type" value={target} options={TARGETS} onChange={onTargetChange} />
      </div>

      {target !== "default" && (
        <SettingRow
          label="Use the default background"
          description="Turn off to give these slides their own color or image."
          htmlFor="bg-inherit"
        >
          <Toggle id="bg-inherit" name="bg-inherit" checked={inherits} onChange={setInherit} />
        </SettingRow>
      )}

      <SettingRow
        label="Color"
        description="Shows when there is no image, and around a video while it loads."
        disabled={inherits}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {COLOR_PRESETS.map((p) => {
            const selected = !url && layer.color.toLowerCase() === p.value
            return (
              <button
                key={p.value}
                type="button"
                title={p.label}
                aria-label={p.label}
                aria-pressed={selected}
                onClick={() => setLayer({ color: p.value, imageId: null, kind: null })}
                className="size-7 rounded-md ring-1 ring-foreground/15 ring-inset outline-offset-2 hover:ring-foreground/40 aria-pressed:outline-2 aria-pressed:outline-foreground"
                style={{ backgroundColor: p.value }}
              />
            )
          })}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Custom color"
                className="grid size-7 place-items-center rounded-md text-muted-foreground ring-1 ring-foreground/15 ring-inset hover:bg-accent hover:text-foreground"
              >
                <Pipette className="size-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-60 space-y-3 p-3 [&_.react-colorful]:h-32 [&_.react-colorful]:w-full [&_.react-colorful__hue]:mt-2 [&_.react-colorful__hue]:h-3 [&_.react-colorful__hue]:rounded-md [&_.react-colorful__saturation]:rounded-md"
            >
              <HexColorPicker
                color={layer.color}
                onChange={(color) => setLayer({ color, imageId: null, kind: null })}
              />
              <input
                name="bg-hex"
                aria-label="Background hex value"
                value={layer.color}
                onChange={(e) => {
                  const v = e.target.value
                  if (/^#[0-9a-f]{0,6}$/i.test(v)) setLayer({ color: v, imageId: null, kind: null })
                }}
                className="w-full rounded-md bg-background px-2 py-1.5 font-mono text-base ring-1 ring-foreground/10 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-ring sm:text-sm dark:bg-white/5"
              />
            </PopoverContent>
          </Popover>
        </div>
      </SettingRow>

      <SettingRow
        label="Image or video"
        description="Covers the whole slide. Videos loop silently."
        disabled={inherits}
      >
        <div className="flex items-center gap-3">
          {url && (
            <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-md bg-black outline-1 -outline-offset-1 outline-foreground/10">
              {layer.kind === "video" ? (
                <video src={url} autoPlay loop muted playsInline className="size-full object-cover" />
              ) : (
                <img src={url} alt="" className="size-full object-cover" />
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex h-7 items-center gap-1.5 rounded-md py-1.5 pr-2.5 pl-2 text-sm ring-1 ring-foreground/10 hover:bg-accent disabled:opacity-50"
          >
            <Upload className="size-4 shrink-0" />
            {uploading ? "Adding…" : url ? "Replace" : "Upload"}
          </button>
          {url && (
            <button
              type="button"
              onClick={() => setLayer({ color: layer.color, imageId: null, kind: null })}
              className="flex h-7 items-center gap-1.5 rounded-md py-1.5 pr-2.5 pl-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-4 shrink-0" />
              Remove
            </button>
          )}
          <input
            ref={fileRef}
            name="bg-file"
            type="file"
            accept="image/*,video/*"
            aria-label="Upload background image or video"
            onChange={handleUpload}
            className="sr-only"
          />
        </div>
      </SettingRow>

      <SettingsGroupLabel>Effects · all slide types</SettingsGroupLabel>

      <SettingRow
        label="Blur"
        description="Softens busy photos and videos so the words stand out. Solid colors are unaffected."
      >
        <SliderField
          label="Background blur"
          value={blur}
          bounds={BACKGROUND_BLUR_BOUNDS}
          format={(v) => (v === 0 ? "Off" : `${v}px`)}
          onChange={(v) => onPresentationChange({ backgroundBlur: v })}
        />
      </SettingRow>

      <SettingRow
        label="Dim"
        description="Darkens photos and videos behind the text."
      >
        <SliderField
          label="Background dim"
          value={dim}
          bounds={BACKGROUND_DIM_BOUNDS}
          format={(v) => (v === 0 ? "Off" : `${v}%`)}
          onChange={(v) => onPresentationChange({ backgroundDim: v })}
        />
      </SettingRow>
    </SettingsSection>
  )
}
