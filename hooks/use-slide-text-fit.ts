import { useLayoutEffect, useRef, useState, type Ref } from "react"
import type { FontSize, SelectedVerse } from "@/components/slide-stage"

const FILL: Record<FontSize, number> = {
  small: 0.5,
  medium: 0.66,
  large: 0.82,
  "extra-large": 0.95,
}

// Cold-start seed for the very first fit of a set of verses.
const SEED_FS = 100
const REFERENCE_RATIO = 0.46
const NOTE_TITLE_RATIO = 0.8
const REFERENCE_MARGIN_RATIO = 0.34
const NOTE_TITLE_MARGIN_RATIO = 0.3
const GAP_RATIO = 0.34
const TOLERANCE = 0.02
const MAX_ITERS = 8

interface UseSlideTextFitOptions {
  verses: SelectedVerse[]
  fontSize: FontSize
  availableHeight: number
  // Width of the safe area. Re-fitting on width changes keeps the text filling
  // the slide after the horizontal margin (and thus line wrapping) changes.
  availableWidth: number
  innerRef?: Ref<HTMLDivElement>
}

// Sizes the verse text to fill the slide's safe area. The fit runs as an
// iterative measure loop on the live element, so it works in *display* space:
// each pass nudges the rendered size toward the target height. That lets a
// re-fit warm-start from the size already on screen — so margin and font-size
// changes animate smoothly instead of blanking. Only a structural change (new
// verses) cold-starts from the seed and hides the text while it converges.
export function useSlideTextFit({
  verses,
  fontSize,
  availableHeight,
  availableWidth,
  innerRef,
}: UseSlideTextFitOptions) {
  const measureRef = useRef<HTMLDivElement | null>(null)
  const [verseFs, setVerseFs] = useState(SEED_FS)
  const [settled, setSettled] = useState(false)
  const iterRef = useRef(0)
  // Whether the in-progress fit should hide the text. Only true for cold
  // (new-verses) fits; warm re-fits stay visible.
  const blankRef = useRef(true)
  const prevVersesRef = useRef(verses)
  const prevAreaRef = useRef<{ h: number; w: number; fontSize: FontSize } | null>(null)

  const targetHeight = availableHeight * FILL[fontSize]

  // Reconcile what changed and start the matching fit. New verses (or the very
  // first run) cold-start from the seed and hide; a same-verses area/fill-ratio
  // change warm-starts from the current size and stays visible. Comparing
  // previous values rather than splitting across effects keeps this correct
  // under StrictMode's double-invoked effects.
  useLayoutEffect(() => {
    const versesChanged = prevVersesRef.current !== verses
    const prevArea = prevAreaRef.current
    const areaChanged =
      !prevArea ||
      prevArea.h !== availableHeight ||
      prevArea.w !== availableWidth ||
      prevArea.fontSize !== fontSize

    prevVersesRef.current = verses
    prevAreaRef.current = { h: availableHeight, w: availableWidth, fontSize }

    if (versesChanged || prevArea === null) {
      blankRef.current = true
      iterRef.current = 0
      setVerseFs(SEED_FS)
      setSettled(false)
    } else if (areaChanged) {
      blankRef.current = false
      iterRef.current = 0
      setSettled(false)
    }
  }, [verses, availableHeight, availableWidth, fontSize])

  useLayoutEffect(() => {
    if (settled) return
    const el = measureRef.current
    if (!el) return
    const h = el.scrollHeight
    if (!h) return

    const ratio = targetHeight / h
    iterRef.current += 1

    if (Math.abs(ratio - 1) < TOLERANCE || iterRef.current >= MAX_ITERS) {
      // Bias the final step toward not overflowing the safe area.
      setVerseFs((cur) => cur * Math.min(1, Math.sqrt(ratio)))
      setSettled(true)
      blankRef.current = false
    } else {
      setVerseFs((cur) => cur * Math.sqrt(ratio))
    }
  }, [targetHeight, verseFs, settled])

  const setRefs = (node: HTMLDivElement | null) => {
    measureRef.current = node
    if (!innerRef) return
    if (typeof innerRef === "function") {
      innerRef(node)
    } else {
      ;(innerRef as { current: HTMLDivElement | null }).current = node
    }
  }

  const measuring = blankRef.current && !settled

  return {
    measuring,
    setRefs,
    verseFs,
    refFs: verseFs * REFERENCE_RATIO,
    noteTitleFs: verseFs * NOTE_TITLE_RATIO,
    refMt: verseFs * REFERENCE_MARGIN_RATIO,
    noteTitleMb: verseFs * NOTE_TITLE_MARGIN_RATIO,
    gap: verseFs * GAP_RATIO,
  }
}
