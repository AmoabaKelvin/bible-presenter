"use client"

import { useRef, useState } from "react"
import { HexColorPicker } from "react-colorful"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Image as ImageIcon, RotateCcw, X } from "lucide-react"
import type { BackgroundTarget } from "@/lib/background-config"
import type { ResolvedBackground } from "@/hooks/use-operator-background"

const PRESETS = [
  { value: "#000000", label: "Black" },
  { value: "#FFFFFF", label: "White" },
  { value: "#0f172a", label: "Slate" },
  { value: "#1e293b", label: "Indigo" },
  { value: "#1c1917", label: "Stone" },
  { value: "#1e3a5f", label: "Navy" },
  { value: "#1b4332", label: "Forest" },
  { value: "#3d0c02", label: "Maroon" },
  { value: "#2d1b4e", label: "Plum" },
  { value: "#0d1b2a", label: "Deep" },
]

// A resolved view of each target (effective color/url/kind + whether the
// per-type slot is an explicit override vs inheriting the default).
export type ResolvedTargets = Record<
  BackgroundTarget,
  ResolvedBackground & { overridden: boolean }
>

const TARGET_TABS: { value: BackgroundTarget; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "scripture", label: "Scripture" },
  { value: "song", label: "Songs" },
  { value: "note", label: "Notes" },
  { value: "definition", label: "Dictionary" },
]

interface BackgroundPopoverProps {
  targets: ResolvedTargets
  onColorChange: (target: BackgroundTarget, color: string) => void
  onUploadImage: (target: BackgroundTarget, file: File) => void
  onClearImage: (target: BackgroundTarget) => void
  onResetLayer: (target: BackgroundTarget) => void
  onResetAll: () => void
}

function Swatch({ resolved }: { resolved: ResolvedBackground }) {
  if (resolved.url && resolved.kind === "video") {
    return (
      <video
        src={resolved.url}
        autoPlay
        loop
        muted
        playsInline
        className="size-4 rounded-sm border border-border object-cover"
      />
    )
  }
  return (
    <div
      className="size-4 rounded-sm border border-border"
      style={{
        backgroundColor: resolved.url ? undefined : resolved.color,
        backgroundImage: resolved.url ? `url(${resolved.url})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    />
  )
}

export function BackgroundPopover({
  targets,
  onColorChange,
  onUploadImage,
  onClearImage,
  onResetLayer,
  onResetAll,
}: BackgroundPopoverProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [target, setTarget] = useState<BackgroundTarget>("default")
  const active = targets[target]

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onUploadImage(target, file)
    e.target.value = ""
  }

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0">
              <Swatch resolved={targets.default} />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Background</TooltipContent>
      </Tooltip>

      <PopoverContent align="end" className="w-72 p-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium">Slide background</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={onResetAll}
          >
            <RotateCcw className="size-3 mr-1" />
            Reset all
          </Button>
        </div>

        {/* Target selector — each type inherits Default unless overridden. */}
        <div className="grid grid-cols-5 gap-1 mb-3">
          {TARGET_TABS.map((tab) => {
            const resolved = targets[tab.value]
            const isActive = target === tab.value
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setTarget(tab.value)}
                className={`flex flex-col items-center gap-1 rounded-sm border px-1 py-1.5 text-[10px] transition-colors ${
                  isActive
                    ? "border-foreground bg-accent"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`}
                title={tab.label}
              >
                <span className="relative">
                  <Swatch resolved={resolved} />
                  {tab.value !== "default" && !resolved.overridden && (
                    <span className="absolute -right-0.5 -bottom-0.5 size-1.5 rounded-full bg-muted-foreground/60 ring-1 ring-card" />
                  )}
                </span>
                <span className="truncate w-full text-center leading-none">{tab.label}</span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-muted-foreground">
            {target === "default"
              ? "Applies everywhere unless a type overrides it."
              : active.overridden
                ? "Overriding the default for this type."
                : "Inheriting the default."}
          </span>
          {target !== "default" && active.overridden && (
            <button
              type="button"
              onClick={() => onResetLayer(target)}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              Inherit
            </button>
          )}
        </div>

        {active.url && (
          <div className="mb-3 relative">
            {active.kind === "video" ? (
              <video
                src={active.url}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-20 rounded-md border border-border object-cover"
              />
            ) : (
              <div
                className="w-full h-20 rounded-md border border-border bg-cover bg-center"
                style={{ backgroundImage: `url(${active.url})` }}
              />
            )}
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-1 right-1 h-6 px-2 text-xs"
              onClick={() => onClearImage(target)}
            >
              <X className="size-3 mr-1" />
              Remove
            </Button>
          </div>
        )}

        <div className="mb-3 [&_.react-colorful]:w-full [&_.react-colorful]:h-32 [&_.react-colorful__saturation]:rounded-md [&_.react-colorful__hue]:h-3 [&_.react-colorful__hue]:rounded-md [&_.react-colorful__hue]:mt-2">
          <HexColorPicker
            color={active.color}
            onChange={(c) => onColorChange(target, c)}
          />
        </div>

        <div className="grid grid-cols-5 gap-1.5 mb-3">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              title={p.label}
              onClick={() => onColorChange(target, p.value)}
              className={`h-7 w-full rounded-sm border transition-all ${
                !active.url &&
                active.color.toUpperCase() === p.value.toUpperCase()
                  ? "ring-2 ring-foreground border-foreground"
                  : "border-border hover:border-muted-foreground"
              }`}
              style={{ backgroundColor: p.value }}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 mb-2">
          <div
            className="size-7 rounded-sm border border-border shrink-0"
            style={{ backgroundColor: active.color }}
          />
          <Input
            value={active.color}
            onChange={(e) => {
              const v = e.target.value
              if (/^#([0-9A-Fa-f]{0,6})$/.test(v)) onColorChange(target, v)
            }}
            className="h-7 text-xs font-mono"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs"
          onClick={() => fileRef.current?.click()}
        >
          <ImageIcon className="size-3.5 mr-1.5" />
          Upload image or video
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleUpload}
          className="hidden"
        />
      </PopoverContent>
    </Popover>
  )
}
