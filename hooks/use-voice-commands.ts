"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { startLocalEngine } from "@/lib/voice-local-engine"
import { parseVoiceTranscript, type VoiceIntent } from "@/lib/voice-parse"
import { matchQuote, warmQuoteIndexes } from "@/lib/voice-quote"

const intentKey = (intent: VoiceIntent) =>
  intent.type === "reference"
    ? `${intent.book.name} ${intent.chapter}:${intent.verse ?? ""}`
    : intent.type === "verse"
      ? `verse ${intent.verse}`
      : intent.type === "back"
        ? "back"
        : `${intent.type} ${intent.delta}`

export type AudioInput = { deviceId: string; label: string }

const canListen = () =>
  typeof window !== "undefined" &&
  typeof navigator.mediaDevices?.getUserMedia === "function" &&
  typeof AudioWorkletNode !== "undefined"

export function useVoiceCommands(onIntent: (intent: VoiceIntent) => void, deviceId: string) {
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState("")
  const [lastAction, setLastAction] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [inputs, setInputs] = useState<AudioInput[]>([])
  const [backend, setBackend] = useState("")
  // False on the server and during hydration, then the real answer.
  const supported = useSyncExternalStore(
    () => () => {},
    canListen,
    () => false,
  )
  const onIntentRef = useRef(onIntent)
  useEffect(() => {
    onIntentRef.current = onIntent
  }, [onIntent])

  useEffect(() => {
    if (!listening) return
    warmQuoteIndexes()
    let firedKey: string | null = null
    let pendingKey: string | null = null

    const fire = (intent: VoiceIntent, source?: "quote") => {
      firedKey = intentKey(intent)
      console.debug(`[voice] -> ${firedKey}${source ? ` (${source})` : ""}`)
      setLastAction(source ? `${firedKey} (${source})` : firedKey)
      onIntentRef.current(intent)
    }

    const stop = startLocalEngine({
      deviceId: deviceId || undefined,
      onStatus: (next) => {
        setStatus(next)
        // Device labels only become readable once the mic is granted.
        if (next === null) {
          void navigator.mediaDevices.enumerateDevices().then((devices) =>
            setInputs(
              devices
                .filter((d) => d.kind === "audioinput" && d.deviceId)
                .map((d) => ({ deviceId: d.deviceId, label: d.label || "Microphone" })),
            ),
          )
        }
      },
      onBackend: setBackend,
      onTranscript: (text, isFinal) => {
        setHeard(text.trim())
        setError(null)
        const intent = parseVoiceTranscript(text)
        const key = intent && intentKey(intent)
        if (isFinal) {
          pendingKey = null
          if (intent && key !== firedKey) fire(intent)
          firedKey = null // next utterance may repeat the same command
          // No reference or command in it: maybe the verse itself was quoted.
          if (!intent) {
            void matchQuote(text).then((match) => {
              const quoted = match && parseVoiceTranscript(match.reference)
              if (!quoted) return
              fire(quoted, "quote")
              firedKey = null // saying the reference right after must still work
            })
          }
          return
        }
        // A reference or command shows up well before the speaker pauses; act
        // once two partials in a row agree on it ("8:2" -> "8:20" -> "8:28" ->
        // "8:28"). Counting partials rather than a timer, because browsers
        // throttle timers in a window that isn't in front. Not for references
        // still missing their verse, or a bare "verse 1" that may yet become
        // "verse 17" — those wait for the final.
        const complete = intent !== null && (intent.type === "reference" ? intent.verse !== undefined : intent.type !== "verse")
        const candidate = complete && key !== firedKey ? key : null
        if (candidate && candidate === pendingKey && intent) fire(intent)
        pendingKey = candidate
      },
      onError: (message) => {
        setError(message)
        setStatus(null)
        setListening(false)
      },
    })
    return stop
  }, [listening, deviceId])

  const toggle = useCallback(() => {
    setError(null)
    setListening((on) => !on)
  }, [])

  return { supported, listening, heard, lastAction, error, status, inputs, backend, toggle }
}
