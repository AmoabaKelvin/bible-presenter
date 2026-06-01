import { useEffect, useRef, useState } from "react"

export function useSlideScale(width: number, height: number) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return

    const update = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (!w || !h) return
      setScale(Math.min(w / width, h / height))
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [height, width])

  return { wrapperRef, scale }
}
