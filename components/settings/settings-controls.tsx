"use client"

// Building blocks for the settings page. Rows pair a label + description with
// one control; every control is a native input underneath (radios for
// segmented choices, a checkbox for toggles) so state styling stays in CSS.

import { useEffect, useId, useMemo, useState, type ComponentType, type ReactNode } from "react"
import { Check, ChevronsUpDown, RotateCcw } from "lucide-react"
import { HexColorPicker } from "react-colorful"
import { Slider } from "@/components/ui/slider"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { GOOGLE_FONTS, loadGoogleFontCatalog, searchGoogleFonts } from "@/lib/google-fonts"
import { fontFamilyCss } from "@/lib/presentation-settings"

// ── Layout ───────────────────────────────────────────────────────────────

interface SettingsSectionProps {
  title: string
  description: string
  onReset?: () => void
  resetDisabled?: boolean
  children: ReactNode
}

export function SettingsSection({
  title,
  description,
  onReset,
  resetDisabled,
  children,
}: SettingsSectionProps) {
  return (
    <section className="@container">
      <div className="flex items-start justify-between gap-6 border-b border-border pb-5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-balance">{title}</h2>
          <p className="mt-1 max-w-[56ch] text-base/6 text-pretty text-muted-foreground sm:text-sm/6">
            {description}
          </p>
        </div>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            disabled={resetDisabled}
            className="flex h-7 shrink-0 items-center gap-1.5 rounded-md py-1.5 pr-2.5 pl-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <RotateCcw className="size-3.5 shrink-0" />
            Reset
          </button>
        )}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  )
}

// A subheading inside a section, for grouping related rows.
export function SettingsGroupLabel({ children }: { children: ReactNode }) {
  return <h3 className="eyebrow pt-8 pb-1">{children}</h3>
}

interface SettingRowProps {
  label: string
  description?: string
  htmlFor?: string
  disabled?: boolean
  children: ReactNode
}

export function SettingRow({ label, description, htmlFor, disabled, children }: SettingRowProps) {
  const Label = htmlFor ? "label" : "div"
  return (
    <div
      className={`grid gap-3 py-5 @xl:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] @xl:gap-8 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <div className="min-w-0">
        <Label htmlFor={htmlFor} className="text-base/6 font-medium sm:text-sm/6">
          {label}
        </Label>
        {description && (
          <p className="text-base/6 text-pretty text-muted-foreground sm:text-sm/6">{description}</p>
        )}
      </div>
      <fieldset disabled={disabled} className="flex min-w-0 items-center @xl:justify-end">
        {children}
      </fieldset>
    </div>
  )
}

// ── Segmented choice (radio group) ───────────────────────────────────────

interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: ComponentType<{ className?: string }>
}

interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
}

export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  const name = useId()
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex max-w-full overflow-x-auto rounded-lg bg-foreground/5 p-0.5 dark:bg-white/5"
    >
      {options.map((opt) => {
        const Icon = opt.icon
        return (
          <label
            key={opt.value}
            className="flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground has-checked:bg-background has-checked:text-foreground has-checked:shadow-xs has-checked:ring-1 has-checked:ring-foreground/10 has-focus-visible:outline-2 has-focus-visible:outline-ring dark:has-checked:bg-accent dark:has-checked:shadow-none"
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            {Icon && <Icon className="size-4 shrink-0" />}
            {opt.label}
          </label>
        )
      })}
    </div>
  )
}

// ── Toggle ───────────────────────────────────────────────────────────────

interface ToggleProps {
  id?: string
  name: string
  label?: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function Toggle({ id, name, label, checked, onChange }: ToggleProps) {
  return (
    <div className="group relative inline-flex w-11 shrink-0 rounded-full bg-foreground/10 p-0.5 inset-ring inset-ring-foreground/5 outline-offset-2 outline-ring transition-colors duration-200 ease-in-out has-checked:bg-primary has-focus-visible:outline-2 has-disabled:opacity-60 sm:w-9 dark:bg-white/10 dark:inset-ring-white/10 dark:has-checked:bg-primary">
      <span className="aspect-square w-1/2 rounded-full bg-white shadow-xs ring-1 ring-foreground/5 transition-transform duration-200 ease-in-out group-has-checked:translate-x-full dark:group-has-checked:bg-background" />
      <input
        id={id}
        name={name}
        type="checkbox"
        aria-label={id ? undefined : label}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="absolute inset-0 size-full cursor-pointer appearance-none focus:outline-hidden disabled:cursor-default"
      />
    </div>
  )
}

// ── Slider with a value readout ──────────────────────────────────────────

interface SliderFieldProps {
  label: string
  value: number
  bounds: { min: number; max: number; step: number }
  format: (value: number) => string
  onChange: (value: number) => void
  disabled?: boolean
}

export function SliderField({ label, value, bounds, format, onChange, disabled }: SliderFieldProps) {
  return (
    <div className="flex w-full max-w-xs items-center gap-4">
      <Slider
        aria-label={label}
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        disabled={disabled}
        className="flex-1"
      />
      <p className="w-14 shrink-0 text-right font-mono text-sm tabular-nums text-muted-foreground">
        {format(value)}
      </p>
    </div>
  )
}

// ── Native select ────────────────────────────────────────────────────────

interface SelectFieldProps {
  id: string
  name: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}

export function SelectField({ id, name, value, options, onChange }: SelectFieldProps) {
  return (
    <div className="inline-grid w-full max-w-xs grid-cols-[1fr_--spacing(8)]">
      <select
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="col-span-full row-start-1 appearance-none rounded-md bg-background py-2 pr-8 pl-3 text-base/6 ring-1 ring-foreground/10 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-ring sm:py-1.5 sm:text-sm/6 dark:bg-white/5"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 8 5"
        width="8"
        height="5"
        fill="none"
        aria-hidden
        className="pointer-events-none col-start-2 row-start-1 place-self-center stroke-muted-foreground"
      >
        <path d="M.5.5 4 4 7.5.5" />
      </svg>
    </div>
  )
}

// ── Color ────────────────────────────────────────────────────────────────

const CHECKER =
  "linear-gradient(45deg,var(--border) 25%,transparent 25%,transparent 75%,var(--border) 75%),linear-gradient(45deg,var(--border) 25%,transparent 25%,transparent 75%,var(--border) 75%)"

interface ColorFieldProps {
  label: string
  value: string
  // Swatches offered under the picker; the empty value is always "Auto".
  presets: { value: string; label: string }[]
  autoFallback: string
  onChange: (value: string) => void
}

// Empty value means "Auto": the slide derives the color from the background.
export function ColorField({ label, value, presets, autoFallback, onChange }: ColorFieldProps) {
  const active = value.trim()
  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${label}: ${active || "Auto"}`}
            className="flex h-9 items-center gap-2 rounded-md bg-background py-1.5 pr-3 pl-1.5 text-sm ring-1 ring-foreground/10 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring dark:bg-white/5"
          >
            <span
              className="size-6 shrink-0 rounded-sm ring-1 ring-foreground/15 ring-inset"
              style={
                active
                  ? { backgroundColor: active }
                  : { backgroundImage: CHECKER, backgroundSize: "8px 8px", backgroundPosition: "0 0,4px 4px" }
              }
            />
            <span className="font-mono tabular-nums">{active ? active.toUpperCase() : "Auto"}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-60 space-y-3 p-3 [&_.react-colorful]:h-32 [&_.react-colorful]:w-full [&_.react-colorful__hue]:mt-2 [&_.react-colorful__hue]:h-3 [&_.react-colorful__hue]:rounded-md [&_.react-colorful__saturation]:rounded-md"
        >
          <HexColorPicker color={active || autoFallback} onChange={onChange} />
          <div className="grid grid-cols-6 gap-1.5">
            {presets.map((p) => (
              <button
                key={p.value}
                type="button"
                title={p.label}
                aria-label={p.label}
                onClick={() => onChange(p.value)}
                className="aspect-square rounded-sm ring-1 ring-foreground/15 ring-inset hover:ring-foreground/40"
                style={{ backgroundColor: p.value }}
              />
            ))}
          </div>
          <input
            name={`${label}-hex`}
            aria-label={`${label} hex value`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Auto"
            className="w-full rounded-md bg-background px-2 py-1.5 font-mono text-base ring-1 ring-foreground/10 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-ring sm:text-sm dark:bg-white/5"
          />
        </PopoverContent>
      </Popover>
      {active && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="h-7 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          Use auto
        </button>
      )}
    </div>
  )
}

// ── Google font picker ───────────────────────────────────────────────────

interface FontPickerProps {
  label: string
  value: string
  onChange: (family: string) => void
  defaultLabel: string
}

export function FontPicker({ label, value, onChange, defaultLabel }: FontPickerProps) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  // Starts as the bundled curated list (instant, offline-safe); swapped for the
  // full Google catalog once it loads so any family becomes searchable.
  const [catalog, setCatalog] = useState<string[]>(GOOGLE_FONTS)
  const [loadingCatalog, setLoadingCatalog] = useState(false)

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
        <button
          type="button"
          role="combobox"
          aria-label={label}
          aria-controls={listId}
          aria-expanded={open}
          className="flex h-9 w-full max-w-xs items-center justify-between gap-2 rounded-md bg-background py-1.5 pr-2 pl-3 text-left text-base ring-1 ring-foreground/10 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring sm:text-sm dark:bg-white/5"
        >
          <span className="min-w-0 truncate" style={{ fontFamily: fontFamilyCss(value) }}>
            {value || defaultLabel}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent id={listId} align="end" className="w-(--radix-popover-trigger-width) min-w-64 p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search Google Fonts…" value={query} onValueChange={setQuery} />
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
                <Check className={`size-4 shrink-0 ${value ? "opacity-0" : ""}`} />
                {defaultLabel}
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
                  <Check className={`size-4 shrink-0 ${value === family ? "" : "opacity-0"}`} />
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
