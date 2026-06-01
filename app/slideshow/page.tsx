"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Maximize, Minimize } from "lucide-react"
import { SlideStage, SlideContent } from "@/components/slide-stage"
import { useFullscreen } from "@/hooks/use-fullscreen"
import { useWakeLock } from "@/hooks/use-wake-lock"
import { useSlideshowProjection } from "@/hooks/use-slideshow-projection"
import { useSlideshowMusicPlayer } from "@/hooks/use-slideshow-music-player"

export default function SlideshowPage() {
  const { data, bgImageUrl, bgKind, mediaImageUrl } = useSlideshowProjection()
  const { needsAudioGesture, enableAudio } = useSlideshowMusicPlayer()

  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()
  // Keep the projector awake the whole time the output is open.
  useWakeLock(true)

  // Auto-hide the cursor and the fullscreen control after a moment of
  // stillness while presenting, so nothing sits on top of the slide.
  const [controlsVisible, setControlsVisible] = useState(true)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const revealControls = useCallback(() => {
    setControlsVisible(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 2500)
  }, [])
  const cursorHidden = isFullscreen && !controlsVisible

  // `F` toggles fullscreen from the output window.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") {
        e.preventDefault()
        toggleFullscreen()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [toggleFullscreen])

  const backgroundColor = data.backgroundColor || (data.darkMode ? "#000000" : "#FFFFFF")
  const backgroundImage = bgImageUrl ?? undefined
  const mediaUrl = mediaImageUrl ?? undefined

  return (
    <div
      className={`relative w-screen h-screen overflow-hidden ${cursorHidden ? "cursor-none" : ""}`}
      onMouseMove={revealControls}
      onTouchStart={revealControls}
    >
      <SlideStage
        backgroundColor={backgroundColor}
        backgroundImage={backgroundImage}
        backgroundKind={bgKind}
        mediaUrl={mediaUrl}
        className="w-full h-full"
      >
        {data.verses.length > 0 && (
          <SlideContent
            verses={data.verses}
            fontSize={data.fontSize}
            backgroundColor={backgroundColor}
            backgroundImage={backgroundImage}
            defaultVersion={data.version}
          />
        )}
      </SlideStage>

      {/* Hidden YouTube IFrame player — receives commands, audio plays here.
          Kept visually offscreen rather than 1×1 so browsers don't throttle it. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          width: 200,
          height: 200,
          opacity: 0,
          pointerEvents: "none",
          left: -9999,
          top: -9999,
        }}
      >
        <div id="yt-player" />
      </div>

      {needsAudioGesture && (
        <button
          type="button"
          onClick={enableAudio}
          className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-full bg-white/90 text-black text-sm font-medium shadow-lg hover:bg-white transition-colors"
        >
          Click to enable audio
        </button>
      )}

      <button
        type="button"
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen (F)"}
        title={isFullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
        className={`fixed bottom-6 left-6 z-50 size-10 grid place-items-center rounded-full bg-black/50 text-white/90 backdrop-blur-sm shadow-lg hover:bg-black/70 transition-opacity ${
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {isFullscreen ? (
          <Minimize className="size-4" />
        ) : (
          <Maximize className="size-4" />
        )}
      </button>
    </div>
  )
}
