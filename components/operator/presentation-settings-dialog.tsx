"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Check,
  ChevronsUpDown,
  RotateCcw,
  Settings2,
  Type,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { SlideContent, SlideStage, type SelectedVerse } from "@/components/slide-stage"
import { useGoogleFont } from "@/hooks/use-google-font"
import { GOOGLE_FONTS, loadGoogleFontCatalog, searchGoogleFonts } from "@/lib/google-fonts"
import {
  DEFAULT_PRESENTATION,
  MARGIN_X_BOUNDS,
  MARGIN_Y_BOUNDS,
  fontFamilyCss,
  type PresentationSettings,
  type ReferenceWeight,
  type ScriptureWeight,
  type SlideAlignment,
  type SlideTextCase,
} from "@/lib/presentation-settings"

const SAMPLE_VERSE: SelectedVerse[] = [
  {
    kind: "scripture",
    id: "presentation-preview",
    book: "John",
    chapter: 3,
    verse: 16,
    text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
    reference: "John 3:16",
    version: "KJV",
  },
]

const ALIGNMENTS: { value: SlideAlignment; label: string; icon: typeof AlignLeft }[] = [
  { value: "left", label: "Left", icon: AlignLeft },
  { value: "center", label: "Center", icon: AlignCenter },
  { value: "right", label: "Right", icon: AlignRight },
]

const CASES: { value: SlideTextCase; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "uppercase", label: "UPPERCASE" },
]

const SCRIPTURE_WEIGHTS: { value: ScriptureWeight; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "regular", label: "Regular" },
  { value: "semibold", label: "Semibold" },
  { value: "bold", label: "Bold" },
]

const REFERENCE_WEIGHTS: { value: ReferenceWeight; label: string }[] = [
  { value: "regular", label: "Regular" },
  { value: "semibold", label: "Semibold" },
  { value: "bold", label: "Bold" },
]

interface SegmentedProps<T extends string> {
  value: T
  options: { value: T; label: string; icon?: typeof AlignLeft }[]
  onChange: (value: T) => void
}

function Segmented<T extends string>({ value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="flex rounded-md border border-border overflow-hidden">
      {options.map((opt) => {
        const Icon = opt.icon
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={`flex flex-1 items-center justify-center gap-1.5 h-9 px-3 text-xs font-medium transition-colors border-l border-border first:border-l-0 ${
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            {Icon && <Icon className="size-3.5" />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="eyebrow text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

interface MarginRowProps {
  label: string
  value: number
  bounds: { min: number; max: number; step: number }
  onChange: (value: number) => void
}

function MarginRow({ label, value, bounds, onChange }: MarginRowProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-[11px] tabular-nums">{value}px</span>
      </div>
      <Slider
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  )
}

interface FontPickerProps {
  value: string
  onChange: (family: string) => void
}

function FontPicker({ value, onChange }: FontPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  // Starts as the bundled curated list (instant, offline-safe); swapped for the
  // full Google catalog once it loads so any family becomes searchable.
  const [catalog, setCatalog] = useState<string[]>(GOOGLE_FONTS)
  const [loadingCatalog, setLoadingCatalog] = useState(false)

  // Pull the full catalog the first time the picker is opened.
  useEffect(() => {
    if (!open || catalog !== GOOGLE_FONTS) return
    let cancelled = false
    setLoadingCatalog(true)
    loadGoogleFontCatalog().then((families) => {
      if (cancelled) return
      setCatalog(families)
      setLoadingCatalog(false)
    })
    return () => {
      cancelled = true
    }
  }, [open, catalog])

  const results = useMemo(() => searchGoogleFonts(query, catalog), [query, catalog])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-9 font-normal"
        >
          <span className="flex items-center gap-2 min-w-0">
            <Type className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate" style={{ fontFamily: fontFamilyCss(value) }}>
              {value || "Default (editorial serif)"}
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search Google Fonts…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {loadingCatalog ? "Loading the full font catalog…" : "No fonts found."}
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__default__"
                onSelect={() => {
                  onChange("")
                  setOpen(false)
                }}
              >
                <Check className={`size-3.5 ${value ? "opacity-0" : "opacity-100"}`} />
                Default (editorial serif)
              </CommandItem>
              {results.map((family) => (
                <CommandItem
                  key={family}
                  value={family}
                  onSelect={() => {
                    onChange(family)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={`size-3.5 ${value === family ? "opacity-100" : "opacity-0"}`}
                  />
                  {family}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

interface PresentationSettingsDialogProps {
  settings: PresentationSettings
  onChange: (settings: PresentationSettings) => void
  backgroundColor: string
  backgroundImage: string | null
  backgroundKind: "image" | "video" | null
  version: string
}

export function PresentationSettingsDialog({
  settings,
  onChange,
  backgroundColor,
  backgroundImage,
  backgroundKind,
  version,
}: PresentationSettingsDialogProps) {
  // Stream the chosen font into the operator window so the live preview below
  // renders in it immediately, before the page-level loader catches up.
  useGoogleFont(settings.fontFamily)

  const update = <K extends keyof PresentationSettings>(
    key: K,
    value: PresentationSettings[K],
  ) => onChange({ ...settings, [key]: value })

  const marginsAtDefault =
    settings.marginX === DEFAULT_PRESENTATION.marginX &&
    settings.marginY === DEFAULT_PRESENTATION.marginY
  const resetMargins = () =>
    onChange({
      ...settings,
      marginX: DEFAULT_PRESENTATION.marginX,
      marginY: DEFAULT_PRESENTATION.marginY,
    })

  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0">
              <Settings2 className="size-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Slide settings</TooltipContent>
      </Tooltip>

      <DialogContent className="max-w-3xl gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle>Slide settings</DialogTitle>
          <DialogDescription>
            Typography and alignment for everything you project. Changes apply live.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-[1fr_320px]">
          <div className="p-6 space-y-5">
            <Field label="Alignment">
              <Segmented
                value={settings.alignment}
                options={ALIGNMENTS}
                onChange={(v) => update("alignment", v)}
              />
            </Field>

            <Field label="Font">
              <FontPicker value={settings.fontFamily} onChange={(v) => update("fontFamily", v)} />
            </Field>

            <Field label="Letter case">
              <Segmented
                value={settings.textCase}
                options={CASES}
                onChange={(v) => update("textCase", v)}
              />
            </Field>

            <Field label="Scripture weight">
              <Segmented
                value={settings.scriptureWeight}
                options={SCRIPTURE_WEIGHTS}
                onChange={(v) => update("scriptureWeight", v)}
              />
            </Field>

            <Field label="Reference weight">
              <Segmented
                value={settings.referenceWeight}
                options={REFERENCE_WEIGHTS}
                onChange={(v) => update("referenceWeight", v)}
              />
            </Field>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="eyebrow text-muted-foreground">Margins</span>
                <button
                  type="button"
                  onClick={resetMargins}
                  disabled={marginsAtDefault}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <RotateCcw className="size-3" />
                  Reset
                </button>
              </div>
              <MarginRow
                label="Horizontal"
                value={settings.marginX}
                bounds={MARGIN_X_BOUNDS}
                onChange={(v) => update("marginX", v)}
              />
              <MarginRow
                label="Vertical"
                value={settings.marginY}
                bounds={MARGIN_Y_BOUNDS}
                onChange={(v) => update("marginY", v)}
              />
            </div>
          </div>

          <div className="p-6 md:border-l border-t md:border-t-0 border-border bg-muted/30 flex flex-col gap-2">
            <span className="eyebrow text-muted-foreground">Preview</span>
            <div className="aspect-video rounded-md overflow-hidden border border-border bg-black">
              <SlideStage
                backgroundColor={backgroundColor}
                backgroundImage={backgroundImage}
                backgroundKind={backgroundKind ?? undefined}
                className="w-full h-full"
              >
                <SlideContent
                  verses={SAMPLE_VERSE}
                  fontSize="large"
                  backgroundColor={backgroundColor}
                  backgroundImage={backgroundImage}
                  defaultVersion={version}
                  presentation={settings}
                />
              </SlideStage>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Google Fonts load over the network; offline they fall back to the editorial serif.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
