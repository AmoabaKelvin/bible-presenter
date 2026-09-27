"use client"

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
} from "lucide-react"
import type { FontSize } from "@/components/slide-stage"
import {
  DEFAULT_PRESENTATION,
  FONT_SCALE_BOUNDS,
  LINE_HEIGHT_BOUNDS,
  MARGIN_X_BOUNDS,
  MARGIN_Y_BOUNDS,
  TRANSITION_MS_BOUNDS,
  type PresentationSettings,
  type ReferencePosition,
  type ReferenceWeight,
  type ScriptureWeight,
  type SlideAlignment,
  type SlideTextCase,
  type SlideTransition,
  type TextShadow,
  type VerticalPosition,
} from "@/lib/presentation-settings"
import {
  ColorField,
  FontPicker,
  Segmented,
  SettingRow,
  SettingsGroupLabel,
  SettingsSection,
  SliderField,
  Toggle,
} from "./settings-controls"

type Patch = (patch: Partial<PresentationSettings>) => void

interface SectionProps {
  settings: PresentationSettings
  onChange: Patch
}

const percent = (v: number) => `${Math.round(v * 100)}%`

// Whether every listed field still holds its default, to disable "Reset".
function atDefault(settings: PresentationSettings, keys: (keyof PresentationSettings)[]) {
  return keys.every((k) => settings[k] === DEFAULT_PRESENTATION[k])
}

function defaultsFor(keys: (keyof PresentationSettings)[]): Partial<PresentationSettings> {
  return Object.fromEntries(keys.map((k) => [k, DEFAULT_PRESENTATION[k]]))
}

const TEXT_COLOR_PRESETS = [
  { value: "#ffffff", label: "White" },
  { value: "#f5f0e6", label: "Cream" },
  { value: "#fde68a", label: "Soft gold" },
  { value: "#d1d5db", label: "Silver" },
  { value: "#111827", label: "Ink" },
  { value: "#1e3a5f", label: "Navy" },
]

const REFERENCE_COLOR_PRESETS = [
  { value: "#ffffff", label: "White" },
  { value: "#d1d5db", label: "Silver" },
  { value: "#9ca3af", label: "Gray" },
  { value: "#fbbf24", label: "Gold" },
  { value: "#93c5fd", label: "Sky" },
  { value: "#4b5563", label: "Slate" },
]

// ── Text ─────────────────────────────────────────────────────────────────

const TEXT_KEYS: (keyof PresentationSettings)[] = [
  "fontFamily",
  "fontScale",
  "scriptureWeight",
  "textCase",
  "lineHeight",
  "textColor",
  "textShadow",
]

export function TextSection({ settings, onChange }: SectionProps) {
  return (
    <SettingsSection
      title="Text"
      description="How scripture, lyrics, and notes look on screen. Sizes fit the slide automatically, so the size here is a nudge up or down."
      onReset={() => onChange(defaultsFor(TEXT_KEYS))}
      resetDisabled={atDefault(settings, TEXT_KEYS)}
    >
      <SettingRow label="Font" description="Any Google Font. Offline, slides fall back to a serif.">
        <FontPicker
          label="Text font"
          value={settings.fontFamily}
          onChange={(fontFamily) => onChange({ fontFamily })}
          defaultLabel="Default serif"
        />
      </SettingRow>

      <SettingRow label="Size">
        <SliderField
          label="Text size"
          value={settings.fontScale}
          bounds={FONT_SCALE_BOUNDS}
          format={percent}
          onChange={(fontScale) => onChange({ fontScale })}
        />
      </SettingRow>

      <SettingRow label="Weight">
        <Segmented<ScriptureWeight>
          label="Text weight"
          value={settings.scriptureWeight}
          options={[
            { value: "light", label: "Light" },
            { value: "regular", label: "Regular" },
            { value: "semibold", label: "Semibold" },
            { value: "bold", label: "Bold" },
          ]}
          onChange={(scriptureWeight) => onChange({ scriptureWeight })}
        />
      </SettingRow>

      <SettingRow label="Letter case">
        <Segmented<SlideTextCase>
          label="Letter case"
          value={settings.textCase}
          options={[
            { value: "default", label: "As written" },
            { value: "uppercase", label: "UPPERCASE" },
          ]}
          onChange={(textCase) => onChange({ textCase })}
        />
      </SettingRow>

      <SettingRow label="Line spacing">
        <SliderField
          label="Line spacing"
          value={settings.lineHeight}
          bounds={LINE_HEIGHT_BOUNDS}
          format={(v) => v.toFixed(2)}
          onChange={(lineHeight) => onChange({ lineHeight })}
        />
      </SettingRow>

      <SettingRow
        label="Color"
        description="Auto picks white over images and a contrasting color over solid backgrounds."
      >
        <ColorField
          label="Text color"
          value={settings.textColor}
          presets={TEXT_COLOR_PRESETS}
          autoFallback="#ffffff"
          onChange={(textColor) => onChange({ textColor })}
        />
      </SettingRow>

      <SettingRow label="Shadow" description="Helps text stay readable over bright or busy backgrounds.">
        <Segmented<TextShadow>
          label="Text shadow"
          value={settings.textShadow}
          options={[
            { value: "none", label: "None" },
            { value: "soft", label: "Soft" },
            { value: "strong", label: "Strong" },
          ]}
          onChange={(textShadow) => onChange({ textShadow })}
        />
      </SettingRow>
    </SettingsSection>
  )
}

// ── Reference ────────────────────────────────────────────────────────────

const REFERENCE_KEYS: (keyof PresentationSettings)[] = [
  "showReference",
  "referenceFontFamily",
  "referenceWeight",
  "referenceItalic",
  "referencePosition",
  "showVersion",
  "referenceColor",
]

export function ReferenceSection({ settings, onChange }: SectionProps) {
  const hidden = !settings.showReference
  const referenceScale = settings.referenceFontScale ?? settings.fontScale
  return (
    <SettingsSection
      title="Reference"
      description="The line that names the passage, like John 3:16 (KJV). It only appears on scripture slides."
      onReset={() =>
        onChange({ ...defaultsFor(REFERENCE_KEYS), referenceFontScale: settings.fontScale })
      }
      resetDisabled={atDefault(settings, REFERENCE_KEYS) && referenceScale === settings.fontScale}
    >
      <SettingRow label="Show reference" htmlFor="show-reference">
        <Toggle
          id="show-reference"
          name="show-reference"
          checked={!hidden}
          onChange={(showReference) => onChange({ showReference })}
        />
      </SettingRow>

      <SettingRow label="Include translation" description="Adds the version, like (KJV), after the reference." htmlFor="show-version" disabled={hidden}>
        <Toggle
          id="show-version"
          name="show-version"
          checked={settings.showVersion}
          onChange={(showVersion) => onChange({ showVersion })}
        />
      </SettingRow>

      <SettingRow label="Position" disabled={hidden}>
        <Segmented<ReferencePosition>
          label="Reference position"
          value={settings.referencePosition}
          options={[
            { value: "above", label: "Above verse" },
            { value: "below", label: "Below verse" },
          ]}
          onChange={(referencePosition) => onChange({ referencePosition })}
        />
      </SettingRow>

      <SettingRow label="Font" disabled={hidden}>
        <FontPicker
          label="Reference font"
          value={settings.referenceFontFamily}
          onChange={(referenceFontFamily) => onChange({ referenceFontFamily })}
          defaultLabel="Same as text"
        />
      </SettingRow>

      <SettingRow label="Size" disabled={hidden}>
        <SliderField
          label="Reference size"
          value={referenceScale}
          bounds={FONT_SCALE_BOUNDS}
          format={percent}
          disabled={hidden}
          onChange={(referenceFontScale) => onChange({ referenceFontScale })}
        />
      </SettingRow>

      <SettingRow label="Weight" disabled={hidden}>
        <Segmented<ReferenceWeight>
          label="Reference weight"
          value={settings.referenceWeight}
          options={[
            { value: "regular", label: "Regular" },
            { value: "semibold", label: "Semibold" },
            { value: "bold", label: "Bold" },
          ]}
          onChange={(referenceWeight) => onChange({ referenceWeight })}
        />
      </SettingRow>

      <SettingRow label="Italic" htmlFor="reference-italic" disabled={hidden}>
        <Toggle
          id="reference-italic"
          name="reference-italic"
          checked={settings.referenceItalic}
          onChange={(referenceItalic) => onChange({ referenceItalic })}
        />
      </SettingRow>

      <SettingRow label="Color" description="Auto uses a softer tone of the text color." disabled={hidden}>
        <ColorField
          label="Reference color"
          value={settings.referenceColor ?? ""}
          presets={REFERENCE_COLOR_PRESETS}
          autoFallback="#d1d5db"
          onChange={(referenceColor) => onChange({ referenceColor })}
        />
      </SettingRow>
    </SettingsSection>
  )
}

// ── Layout ───────────────────────────────────────────────────────────────

const LAYOUT_KEYS: (keyof PresentationSettings)[] = [
  "alignment",
  "verticalPosition",
  "marginX",
  "marginY",
]

const FILL_OPTIONS: { value: FontSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "extra-large", label: "Full" },
]

interface LayoutSectionProps extends SectionProps {
  fill: FontSize
  onFillChange: (fill: FontSize) => void
}

export function LayoutSection({ settings, onChange, fill, onFillChange }: LayoutSectionProps) {
  return (
    <SettingsSection
      title="Layout"
      description="Where the text sits and how much of the slide it fills."
      onReset={() => {
        onChange(defaultsFor(LAYOUT_KEYS))
        onFillChange("extra-large")
      }}
      resetDisabled={atDefault(settings, LAYOUT_KEYS) && fill === "extra-large"}
    >
      <SettingRow
        label="Fill"
        description="How much of the safe area the text grows to fill. Same as S / M / L / XL beside the preview."
      >
        <Segmented<FontSize> label="Text fill" value={fill} options={FILL_OPTIONS} onChange={onFillChange} />
      </SettingRow>

      <SettingRow label="Horizontal alignment">
        <Segmented<SlideAlignment>
          label="Horizontal alignment"
          value={settings.alignment}
          options={[
            { value: "left", label: "Left", icon: AlignLeft },
            { value: "center", label: "Center", icon: AlignCenter },
            { value: "right", label: "Right", icon: AlignRight },
          ]}
          onChange={(alignment) => onChange({ alignment })}
        />
      </SettingRow>

      <SettingRow label="Vertical position" description="Top or bottom works well for lower-thirds over a camera feed.">
        <Segmented<VerticalPosition>
          label="Vertical position"
          value={settings.verticalPosition}
          options={[
            { value: "top", label: "Top", icon: AlignVerticalJustifyStart },
            { value: "center", label: "Middle", icon: AlignVerticalJustifyCenter },
            { value: "bottom", label: "Bottom", icon: AlignVerticalJustifyEnd },
          ]}
          onChange={(verticalPosition) => onChange({ verticalPosition })}
        />
      </SettingRow>

      <SettingsGroupLabel>Safe area</SettingsGroupLabel>

      <SettingRow
        label="Side margins"
        description="Space kept clear on the left and right. Raise it if a TV crops the edges."
      >
        <SliderField
          label="Side margins"
          value={settings.marginX}
          bounds={MARGIN_X_BOUNDS}
          format={(v) => `${v}px`}
          onChange={(marginX) => onChange({ marginX })}
        />
      </SettingRow>

      <SettingRow label="Top and bottom margins" description="Space kept clear above and below the text.">
        <SliderField
          label="Top and bottom margins"
          value={settings.marginY}
          bounds={MARGIN_Y_BOUNDS}
          format={(v) => `${v}px`}
          onChange={(marginY) => onChange({ marginY })}
        />
      </SettingRow>
    </SettingsSection>
  )
}

// ── Transition ───────────────────────────────────────────────────────────

const TRANSITION_KEYS: (keyof PresentationSettings)[] = ["transition", "transitionMs"]

export function TransitionSection({
  settings,
  onChange,
  onReplay,
}: SectionProps & { onReplay: () => void }) {
  const fade = settings.transition === "fade"
  return (
    <SettingsSection
      title="Transition"
      description="How a new slide appears on the projector. The operator previews always switch instantly."
      onReset={() => onChange(defaultsFor(TRANSITION_KEYS))}
      resetDisabled={atDefault(settings, TRANSITION_KEYS)}
    >
      <SettingRow label="Style">
        <Segmented<SlideTransition>
          label="Transition style"
          value={settings.transition}
          options={[
            { value: "none", label: "Cut" },
            { value: "fade", label: "Fade in" },
          ]}
          onChange={(transition) => {
            onChange({ transition })
            if (transition === "fade") onReplay()
          }}
        />
      </SettingRow>

      <SettingRow label="Duration" disabled={!fade}>
        <SliderField
          label="Transition duration"
          value={settings.transitionMs}
          bounds={TRANSITION_MS_BOUNDS}
          format={(v) => `${(v / 1000).toFixed(2)}s`}
          disabled={!fade}
          onChange={(transitionMs) => onChange({ transitionMs })}
        />
      </SettingRow>
    </SettingsSection>
  )
}
