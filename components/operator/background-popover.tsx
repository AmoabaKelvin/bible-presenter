"use client"

import { useRef } from "react"
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

interface BackgroundPopoverProps {
  backgroundColor: string
  backgroundImage: string | null
  onColorChange: (c: string) => void
  onUploadImage: (file: File) => void
  onClearImage: () => void
  onReset: () => void
}

export function BackgroundPopover({
  backgroundColor,
  backgroundImage,
  onColorChange,
  onUploadImage,
  onClearImage,
  onReset,
}: BackgroundPopoverProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onUploadImage(file)
    e.target.value = ""
  }

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0">
              <div
                className="size-4 rounded-sm border border-border"
                style={{
                  backgroundColor: backgroundImage ? undefined : backgroundColor,
                  backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
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
            onClick={onReset}
          >
            <RotateCcw className="size-3 mr-1" />
            Reset
          </Button>
        </div>

        {backgroundImage && (
          <div className="mb-3 relative">
            <div
              className="w-full h-20 rounded-md border border-border bg-cover bg-center"
              style={{ backgroundImage: `url(${backgroundImage})` }}
            />
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-1 right-1 h-6 px-2 text-xs"
              onClick={() => onClearImage()}
            >
              <X className="size-3 mr-1" />
              Remove
            </Button>
          </div>
        )}

        <div className="mb-3 [&_.react-colorful]:w-full [&_.react-colorful]:h-32 [&_.react-colorful__saturation]:rounded-md [&_.react-colorful__hue]:h-3 [&_.react-colorful__hue]:rounded-md [&_.react-colorful__hue]:mt-2">
          <HexColorPicker
            color={backgroundColor}
            onChange={(c) => {
              onColorChange(c)
              onClearImage()
            }}
          />
        </div>

        <div className="grid grid-cols-5 gap-1.5 mb-3">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              title={p.label}
              onClick={() => {
                onColorChange(p.value)
                onClearImage()
              }}
              className={`h-7 w-full rounded-sm border transition-all ${
                !backgroundImage &&
                backgroundColor.toUpperCase() === p.value.toUpperCase()
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
            style={{ backgroundColor }}
          />
          <Input
            value={backgroundColor}
            onChange={(e) => {
              const v = e.target.value
              if (/^#([0-9A-Fa-f]{0,6})$/.test(v)) {
                onColorChange(v)
                onClearImage()
              }
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
          Upload image
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="hidden"
        />
      </PopoverContent>
    </Popover>
  )
}
