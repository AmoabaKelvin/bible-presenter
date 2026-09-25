"use client"

// Full-screen settings for the operator console. Slide appearance (text,
// reference, background, layout, transition) is edited as a draft beside a
// live preview and only reaches the projector on Save — tweaking fonts
// mid-service must never flash on the big screen. App preferences (theme,
// translation, voice, offline Bibles) apply immediately since they never touch
// the projector.

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import {
  Blend,
  BookOpen,
  Download,
  Image as ImageIcon,
  Keyboard,
  LayoutTemplate,
  Play,
  SlidersHorizontal,
  Type,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { SlideContent, SlideStage, type FontSize, type SelectedVerse } from "@/components/slide-stage"
import { useGoogleFont } from "@/hooks/use-google-font"
import { resolveImageUrl } from "@/lib/image-store"
import {
  normalizeBackgroundConfig,
  resolveLayer,
  type BackgroundConfig,
  type BackgroundLayer,
  type BackgroundTarget,
} from "@/lib/background-config"
import { mergePresentation, type PresentationSettings } from "@/lib/presentation-settings"
import { Segmented } from "./settings-controls"
import { LayoutSection, ReferenceSection, TextSection, TransitionSection } from "./slide-sections"
import { BackgroundSection } from "./background-section"
import { GeneralSection, OfflineSection, ShortcutsSection } from "./app-sections"

export type SettingsSectionId =
  | "text"
  | "reference"
  | "background"
  | "layout"
  | "transition"
  | "general"
  | "offline"
  | "shortcuts"

type NavItem = { id: SettingsSectionId; label: string; icon: typeof Type }

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Slides",
    items: [
      { id: "text", label: "Text", icon: Type },
      { id: "reference", label: "Reference", icon: BookOpen },
      { id: "background", label: "Background", icon: ImageIcon },
      { id: "layout", label: "Layout", icon: LayoutTemplate },
      { id: "transition", label: "Transition", icon: Blend },
    ],
  },
  {
    group: "App",
    items: [
      { id: "general", label: "General", icon: SlidersHorizontal },
      { id: "offline", label: "Offline Bibles", icon: Download },
      { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
    ],
  },
]

const SLIDE_SECTIONS = new Set<SettingsSectionId>(NAV[0].items.map((i) => i.id))

type SampleKind = "scripture" | "song" | "note"

const SAMPLES: Record<SampleKind, SelectedVerse> = {
  scripture: {
    kind: "scripture",
    id: "settings-sample-scripture",
    book: "John",
    chapter: 3,
    verse: 16,
    text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
    reference: "John 3:16",
    version: "KJV",
  },
  song: {
    kind: "song",
    id: "settings-sample-song",
    book: "",
    chapter: 0,
    verse: 0,
    text: "Amazing grace, how sweet the sound\nThat saved a wretch like me\nI once was lost, but now am found\nWas blind, but now I see",
    reference: "",
  },
  note: {
    kind: "note",
    id: "settings-sample-note",
    book: "",
    chapter: 0,
    verse: 0,
    text: "- God is **faithful** in every season\n- His word does not return empty\n- His love endures forever",
    reference: "Three things to hold on to",
  },
}

interface SlideDraft {
  presentation: PresentationSettings
  background: BackgroundConfig
  fontSize: FontSize
}

function useMinWidth(px: number) {
  const query = `(min-width: ${px}px)`
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    },
    () => window.matchMedia(query).matches,
    () => true,
  )
}

interface SettingsPageProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  section: SettingsSectionId
  onSectionChange: (section: SettingsSectionId) => void
  presentation: PresentationSettings
  onPresentationChange: (settings: PresentationSettings) => void
  background: BackgroundConfig
  onBackgroundChange: (config: BackgroundConfig) => void
  fontSize: FontSize
  onFontSizeChange: (fontSize: FontSize) => void
  version: string
  onVersionChange: (version: string) => void
  voiceAutoProject: boolean
  onVoiceAutoProjectChange: (value: boolean) => void
}

export function SettingsPage({
  open,
  onOpenChange,
  section,
  onSectionChange,
  presentation,
  onPresentationChange,
  background,
  onBackgroundChange,
  fontSize,
  onFontSizeChange,
  version,
  onVersionChange,
  voiceAutoProject,
  onVoiceAutoProjectChange,
}: SettingsPageProps) {
  const committed = useMemo<SlideDraft>(
    () => ({ presentation: mergePresentation(presentation), background, fontSize }),
    [presentation, background, fontSize],
  )
  const [draft, setDraft] = useState<SlideDraft>(committed)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [sample, setSample] = useState<SampleKind>("scripture")
  const [bgTarget, setBgTarget] = useState<BackgroundTarget>("default")
  const [replayKey, setReplayKey] = useState(0)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const wide = useMinWidth(1280)

  // Every open starts from what's saved, so a discarded session never leaks.
  useEffect(() => {
    if (open) setDraft(committed)
    // Only on open: later commits come from our own Save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useGoogleFont(draft.presentation.fontFamily)
  useGoogleFont(draft.presentation.referenceFontFamily)

  // Resolve object URLs for any image the draft points at.
  useEffect(() => {
    const layers = [
      draft.background.default,
      draft.background.scripture,
      draft.background.song,
      draft.background.note,
      draft.background.definition,
    ]
    const missing = layers
      .map((l) => l?.imageId)
      .filter((id): id is string => !!id && !urls[id])
    if (missing.length === 0) return
    let cancelled = false
    Promise.all(missing.map(async (id) => [id, await resolveImageUrl(id)] as const)).then(
      (entries) => {
        if (cancelled) return
        setUrls((prev) => {
          const next = { ...prev }
          for (const [id, url] of entries) if (url) next[id] = url
          return next
        })
      },
    )
    return () => {
      cancelled = true
    }
  }, [draft.background, urls])

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(committed), [draft, committed])

  const patchPresentation = useCallback(
    (patch: Partial<PresentationSettings>) =>
      setDraft((d) => ({ ...d, presentation: { ...d.presentation, ...patch } })),
    [],
  )

  const save = () => {
    onPresentationChange(draft.presentation)
    onBackgroundChange(normalizeBackgroundConfig(draft.background))
    onFontSizeChange(draft.fontSize)
  }
  const discard = () => setDraft(committed)

  const requestClose = () => {
    if (dirty) setConfirmDiscard(true)
    else onOpenChange(false)
  }

  const changeBgTarget = (target: BackgroundTarget) => {
    setBgTarget(target)
    if (target === "scripture" || target === "song" || target === "note") setSample(target)
  }

  // In the Background section the preview follows the slot being edited;
  // elsewhere it shows what the sample's slide type would really get.
  const previewKind = section === "background" ? bgTarget : sample
  const previewLayer: BackgroundLayer =
    previewKind === "default" ? draft.background.default : resolveLayer(draft.background, previewKind)

  const isSlideSection = SLIDE_SECTIONS.has(section)

  const preview = (
    <SlidePreview
      draft={draft}
      layer={previewLayer}
      url={previewLayer.imageId ? (urls[previewLayer.imageId] ?? null) : null}
      sample={sample}
      onSampleChange={setSample}
      version={version}
      replayKey={replayKey}
      onReplay={() => setReplayKey((k) => k + 1)}
      dirty={dirty}
    />
  )

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          // Keep the console's global shortcuts (Space = go live, Esc = clear)
          // from firing behind the settings page.
          onKeyDown={(e) => e.stopPropagation()}
          className="fixed inset-0 z-50 isolate flex flex-col bg-background text-foreground duration-150 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-4 sm:px-6">
            <DialogPrimitive.Title className="text-base font-semibold">Settings</DialogPrimitive.Title>
            <button
              type="button"
              onClick={requestClose}
              className="relative flex h-8 items-center gap-2 rounded-md py-1.5 pr-1.5 pl-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <kbd className="font-mono text-xs max-sm:hidden">Esc</kbd>
              <X className="size-4 shrink-0" />
              <span className="sr-only">Close settings</span>
              <span
                className="absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden"
                aria-hidden="true"
              />
            </button>
          </header>

          {/* Small screens: the section list becomes a scrolling tab bar. */}
          <nav aria-label="Settings sections" className="shrink-0 overflow-x-auto border-b border-border lg:hidden">
            <ul role="list" className="flex gap-1 px-4 py-2 sm:px-6">
              {NAV.flatMap((g) => g.items).map((item) => (
                <li key={item.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => onSectionChange(item.id)}
                    aria-current={section === item.id ? "page" : undefined}
                    className="rounded-md px-3 py-1.5 text-base/6 text-muted-foreground hover:text-foreground aria-[current=page]:bg-accent aria-[current=page]:text-foreground sm:text-sm/6"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex min-h-0 flex-1">
            <nav
              aria-label="Settings sections"
              className="w-60 shrink-0 overflow-y-auto border-r border-border p-3 max-lg:hidden"
            >
              {NAV.map((group) => (
                <div key={group.group} className="not-first:mt-6">
                  <p className="eyebrow px-2.5 pb-2">{group.group}</p>
                  <ul role="list" className="flex flex-col gap-0.5">
                    {group.items.map(({ id, label, icon: Icon }) => (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => onSectionChange(id)}
                          aria-current={section === id ? "page" : undefined}
                          className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground aria-[current=page]:bg-accent aria-[current=page]:text-foreground"
                        >
                          <Icon className="size-4 shrink-0" />
                          {label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1">
                <main className="scroll-thin min-w-0 flex-1 overflow-y-auto">
                  <div className="px-4 py-8 sm:px-8 lg:px-10">
                    {isSlideSection && !wide && <div className="mb-10 max-w-xl">{preview}</div>}
                    <div className="max-w-3xl">
                      {section === "text" && (
                        <TextSection settings={draft.presentation} onChange={patchPresentation} />
                      )}
                      {section === "reference" && (
                        <ReferenceSection settings={draft.presentation} onChange={patchPresentation} />
                      )}
                      {section === "background" && (
                        <BackgroundSection
                          config={draft.background}
                          onConfigChange={(config) => setDraft((d) => ({ ...d, background: config }))}
                          urls={urls}
                          onUrlResolved={(id, url) => setUrls((prev) => ({ ...prev, [id]: url }))}
                          presentation={draft.presentation}
                          onPresentationChange={patchPresentation}
                          target={bgTarget}
                          onTargetChange={changeBgTarget}
                        />
                      )}
                      {section === "layout" && (
                        <LayoutSection
                          settings={draft.presentation}
                          onChange={patchPresentation}
                          fill={draft.fontSize}
                          onFillChange={(fill) => setDraft((d) => ({ ...d, fontSize: fill }))}
                        />
                      )}
                      {section === "transition" && (
                        <TransitionSection
                          settings={draft.presentation}
                          onChange={patchPresentation}
                          onReplay={() => setReplayKey((k) => k + 1)}
                        />
                      )}
                      {section === "general" && (
                        <GeneralSection
                          version={version}
                          onVersionChange={onVersionChange}
                          voiceAutoProject={voiceAutoProject}
                          onVoiceAutoProjectChange={onVoiceAutoProjectChange}
                        />
                      )}
                      {section === "offline" && <OfflineSection />}
                      {section === "shortcuts" && <ShortcutsSection />}
                    </div>
                  </div>
                </main>

                {isSlideSection && wide && (
                  <aside className="scroll-thin w-[clamp(28rem,38vw,44rem)] shrink-0 overflow-y-auto border-l border-border p-6">
                    {preview}
                  </aside>
                )}
              </div>

              {dirty && (
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border bg-background px-4 py-3 sm:px-8 lg:px-10">
                  <p className="text-base/6 text-muted-foreground sm:text-sm/6">
                    Unsaved slide changes. The projector keeps the saved look until you save.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={discard}
                      className="h-7 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      Discard
                    </button>
                    <Button onClick={save} className="h-9 px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                      Save changes
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your slide changes have not been saved. The projector will keep its current look.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep editing</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    discard()
                    onOpenChange(false)
                  }}
                >
                  Discard changes
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

interface SlidePreviewProps {
  draft: SlideDraft
  layer: BackgroundLayer
  url: string | null
  sample: SampleKind
  onSampleChange: (sample: SampleKind) => void
  version: string
  replayKey: number
  onReplay: () => void
  dirty: boolean
}

function SlidePreview({
  draft,
  layer,
  url,
  sample,
  onSampleChange,
  version,
  replayKey,
  onReplay,
  dirty,
}: SlidePreviewProps) {
  const { presentation } = draft
  const fadeMs = presentation.transition === "fade" ? presentation.transitionMs : 0
  const verses = useMemo(() => [SAMPLES[sample]], [sample])
  const kind = url ? (layer.kind ?? "image") : undefined

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">Preview</p>
        <Segmented<SampleKind>
          label="Preview sample"
          value={sample}
          options={[
            { value: "scripture", label: "Scripture" },
            { value: "song", label: "Song" },
            { value: "note", label: "Note" },
          ]}
          onChange={onSampleChange}
        />
      </div>
      <div className="aspect-video overflow-hidden rounded-lg bg-black outline-1 -outline-offset-1 outline-foreground/10">
        <SlideStage
          backgroundColor={layer.color}
          backgroundImage={url}
          backgroundKind={kind}
          backgroundBlur={presentation.backgroundBlur}
          backgroundDim={presentation.backgroundDim}
          className="size-full"
        >
          <div
            key={`${sample}-${replayKey}`}
            className="absolute inset-0"
            style={fadeMs ? { animation: `slide-fade-in ${fadeMs}ms ease-out both` } : undefined}
          >
            <SlideContent
              verses={verses}
              fontSize={draft.fontSize}
              backgroundColor={layer.color}
              backgroundImage={url}
              defaultVersion={version}
              presentation={presentation}
            />
          </div>
        </SlideStage>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base/6 text-pretty text-muted-foreground sm:text-sm/6">
          {dirty ? "Showing your unsaved changes." : "This is how slides look on the projector."}
        </p>
        {fadeMs > 0 && (
          <button
            type="button"
            onClick={onReplay}
            className="flex h-7 shrink-0 items-center gap-1.5 rounded-md py-1.5 pr-2.5 pl-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Play className="size-4 shrink-0" />
            Replay fade
          </button>
        )}
      </div>
    </div>
  )
}
