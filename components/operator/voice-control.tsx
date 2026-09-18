"use client"

import { Download, Mic, MicOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HELPER_DOWNLOAD_URL } from "@/lib/voice-local-engine"

interface VoiceButtonProps {
  supported: boolean
  listening: boolean
  onToggle: () => void
}

export function VoiceButton({ supported, listening, onToggle }: VoiceButtonProps) {
  return (
    <Button
      size="sm"
      variant="outline"
      className={`h-8 px-2 ${listening ? "border-red-500/60 text-red-500" : ""}`}
      onClick={onToggle}
      disabled={!supported}
      aria-pressed={listening}
      aria-label={listening ? "Stop voice commands" : "Start voice commands"}
      title={supported ? "Voice commands" : "This browser can't capture audio"}
    >
      {listening ? <Mic className="size-3.5 animate-pulse" /> : <MicOff className="size-3.5" />}
    </Button>
  )
}

interface VoiceStatusProps {
  listening: boolean
  status: string | null
  backend: string
  needsHelper: boolean
  onUseInBrowser: () => void
  inputs: { deviceId: string; label: string }[]
  deviceId: string
  onDeviceChange: (deviceId: string) => void
  heard: string
  lastAction: string
  error: string | null
  autoProject: boolean
  onAutoProjectChange: (on: boolean) => void
}

// Shows what the recognizer heard and what it did with it — the only way to
// tell a mishearing from a misparse while standing at the desk.
export function VoiceStatus({
  listening,
  status,
  backend,
  needsHelper,
  onUseInBrowser,
  inputs,
  deviceId,
  onDeviceChange,
  heard,
  lastAction,
  error,
  autoProject,
  onAutoProjectChange,
}: VoiceStatusProps) {
  if (!listening && !error) return null
  // The in-browser model is a ~2.4 GB download, so it is offered, never
  // started unasked.
  if (needsHelper) {
    return (
      <div className="shrink-0 px-4 py-1.5 border-b border-border flex items-center gap-2 text-xs" aria-live="polite">
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          Voice helper not running — it is faster and needs no download.
        </span>
        <a
          href={HELPER_DOWNLOAD_URL}
          download
          // Not notarized by Apple, so the first launch needs the right-click.
          title="Downloads FlowCastVoice.zip — unzip it, move it to Applications, then right-click it and choose Open the first time"
          className="shrink-0 h-6 px-2 rounded-sm border border-foreground bg-foreground text-background inline-flex items-center gap-1"
        >
          <Download className="size-3" />
          Get the helper
        </a>
        <button
          onClick={onUseInBrowser}
          title="Run the speech model inside this browser instead"
          className="shrink-0 h-6 px-2 rounded-sm border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          Use this browser (2.4 GB)
        </button>
      </div>
    )
  }
  return (
    <div
      className="shrink-0 px-4 py-1.5 border-b border-border flex items-center gap-2 text-xs"
      aria-live="polite"
    >
      <span className={`min-w-0 flex-1 truncate ${error ? "text-red-500" : "text-muted-foreground"}`}>
        {error ?? status ?? (heard ? `“${heard}”` : "Listening…")}
      </span>
      {lastAction && !error && <span className="shrink-0 font-mono text-foreground">→ {lastAction}</span>}
      {listening && backend && (
        <span
          className="shrink-0 text-muted-foreground/70"
          title={
            backend === "helper"
              ? "Recognized by the FlowCast Voice helper app (fast)"
              : "Recognized inside the browser (slow). Run the FlowCast Voice helper app for instant results."
          }
        >
          {backend === "helper" ? "Helper" : "In-browser"}
        </span>
      )}
      {inputs.length > 1 && (
        <select
          value={deviceId}
          onChange={(e) => onDeviceChange(e.target.value)}
          aria-label="Microphone input"
          title="Which input to listen to — pick the PA / mixer feed"
          className="shrink-0 h-6 max-w-32 rounded-sm border border-border bg-transparent text-muted-foreground"
        >
          <option value="">Default input</option>
          {inputs.map((input) => (
            <option key={input.deviceId} value={input.deviceId}>
              {input.label}
            </option>
          ))}
        </select>
      )}
      <button
        onClick={() => onAutoProjectChange(!autoProject)}
        aria-pressed={autoProject}
        title="Send spoken scriptures straight to live instead of preview"
        className={`shrink-0 h-6 px-2 rounded-sm border transition-colors ${
          autoProject
            ? "bg-foreground text-background border-foreground"
            : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
        }`}
      >
        Auto-live
      </button>
    </div>
  )
}
