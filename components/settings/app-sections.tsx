"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { OfflineManager } from "@/components/operator/offline-manager"
import { BIBLE_VERSIONS } from "@/lib/bible-data"
import { Segmented, SelectField, SettingRow, SettingsSection, Toggle } from "./settings-controls"

interface GeneralSectionProps {
  version: string
  onVersionChange: (version: string) => void
  voiceAutoProject: boolean
  onVoiceAutoProjectChange: (value: boolean) => void
}

export function GeneralSection({
  version,
  onVersionChange,
  voiceAutoProject,
  onVoiceAutoProjectChange,
}: GeneralSectionProps) {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <SettingsSection
      title="General"
      description="Preferences for this console. These apply right away and never change what is on the projector."
    >
      <SettingRow label="Appearance" description="The console theme. Slides keep their own background.">
        <Segmented<"light" | "dark">
          label="Appearance"
          value={resolvedTheme === "dark" ? "dark" : "light"}
          options={[
            { value: "light", label: "Light", icon: Sun },
            { value: "dark", label: "Dark", icon: Moon },
          ]}
          onChange={setTheme}
        />
      </SettingRow>

      <SettingRow
        label="Translation"
        description="Used for the reader, search, and new scripture slides."
        htmlFor="bible-version"
      >
        <SelectField
          id="bible-version"
          name="bible-version"
          value={version}
          options={BIBLE_VERSIONS.map((v) => ({ value: v.code, label: `${v.code} · ${v.name}` }))}
          onChange={onVersionChange}
        />
      </SettingRow>

      <SettingRow
        label="Voice goes straight to live"
        description="When off, a spoken reference lands in preview and waits for Space. Safer mid-sermon."
        htmlFor="voice-auto-project"
      >
        <Toggle
          id="voice-auto-project"
          name="voice-auto-project"
          checked={voiceAutoProject}
          onChange={onVoiceAutoProjectChange}
        />
      </SettingRow>
    </SettingsSection>
  )
}

export function OfflineSection() {
  return (
    <SettingsSection
      title="Offline Bibles"
      description="Download translations to this device so the reader and search keep working without internet."
    >
      <div className="py-5">
        <OfflineManager className="w-full max-w-xl" listClassName="" />
      </div>
    </SettingsSection>
  )
}

const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ["Space"], action: "Send the preview live" },
  { keys: ["Esc"], action: "Clear the live slide" },
  { keys: ["←", "→"], action: "Previous or next item in the queue" },
  { keys: ["↑", "↓"], action: "Previous or next verse in the reader" },
  { keys: ["[", "]"], action: "Previous or next chapter" },
  { keys: ["/"], action: "Jump to a reference" },
  { keys: ["?"], action: "Change translation" },
  { keys: ["⌘", "K"], action: "Search scripture and the dictionary" },
  { keys: ["⌘", ","], action: "Open settings" },
  { keys: ["F"], action: "Toggle fullscreen in the projector window" },
]

export function ShortcutsSection() {
  return (
    <SettingsSection title="Keyboard shortcuts" description="Work while you are not typing in a field.">
      <dl className="divide-y divide-border">
        {SHORTCUTS.map((s) => (
          <div key={s.action} className="flex items-center justify-between gap-6 py-3">
            <dt className="text-base/6 text-muted-foreground sm:text-sm/6">{s.action}</dt>
            <dd className="flex shrink-0 gap-1">
              {s.keys.map((k) => (
                <kbd
                  key={k}
                  className="grid h-6 min-w-6 place-items-center rounded-md bg-foreground/5 px-1.5 font-mono text-xs text-foreground ring-1 ring-foreground/10 ring-inset"
                >
                  {k}
                </kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </SettingsSection>
  )
}
