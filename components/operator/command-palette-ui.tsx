"use client"

export type PaletteMode = "scripture" | "dictionary"

export function PaletteModeTabs({
  value,
  onChange,
}: {
  value: PaletteMode
  onChange: (mode: PaletteMode) => void
}) {
  return (
    <div className="flex items-center gap-1 border-b px-2 py-1.5">
      {(["scripture", "dictionary"] as PaletteMode[]).map((mode) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={`h-6 px-2.5 rounded text-[11px] font-medium transition-colors ${
            value === mode
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {mode === "scripture" ? "Scripture" : "Define"}
        </button>
      ))}
    </div>
  )
}

export function PaletteKbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center rounded border border-border bg-muted px-1 font-mono text-[10px]">
      {children}
    </kbd>
  )
}
