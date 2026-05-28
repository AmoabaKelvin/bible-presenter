interface WavesMarkProps {
  className?: string
}

// Horizontal "waves" mark — three flowing strokes evoking flow / sound.
export function WavesMark({ className }: WavesMarkProps) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 10q3.5-4 7 0t7 0 7 0" opacity={0.55} />
      <path d="M3 14q3.5-4 7 0t7 0 7 0" />
      <path d="M3 18q3.5-4 7 0t7 0 7 0" opacity={0.55} />
    </svg>
  )
}

interface BrandLogoProps {
  className?: string
}

// Lockup: bare waves mark + the "flowwww" wordmark in Fraunces. The mark
// inherits text-foreground, so it's dark on light and white on dark.
export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <div className={`flex items-center gap-2 text-foreground ${className ?? ""}`}>
      <WavesMark className="size-6 shrink-0" />
      <span className="font-wordmark text-[19px] leading-none tracking-tight lowercase">
        flowwww
      </span>
    </div>
  )
}
