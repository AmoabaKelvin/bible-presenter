"use client"

import { useEffect, useRef } from "react"
import { ChevronUp, ChevronDown, Trash2, Eye, Plus, Radio } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { SongSlide } from "./types"

interface SongSlideCardProps {
  slide: SongSlide
  index: number
  total: number
  isNew: boolean
  isLive: boolean
  onChange: (patch: Partial<Pick<SongSlide, "label" | "lines">>) => void
  onPreview: () => void
  onProject: () => void
  onQueue: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

export function SongSlideCard({
  slide,
  index,
  total,
  isNew,
  isLive,
  onChange,
  onPreview,
  onProject,
  onQueue,
  onDelete,
  onMoveUp,
  onMoveDown,
}: SongSlideCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const enteredRef = useRef(false)

  // A freshly added slide scrolls into view and takes focus, once.
  useEffect(() => {
    if (!isNew || enteredRef.current) return
    enteredRef.current = true
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    textareaRef.current?.focus()
  }, [isNew])

  return (
    <div
      ref={cardRef}
      className={`rounded-lg bg-card/40 overflow-hidden transition-colors ${
        isLive
          ? "border-2 border-[color:var(--live)]"
          : "border border-border focus-within:border-foreground/25"
      } ${isNew ? "animate-in fade-in-0 slide-in-from-top-2 duration-300 ease-out" : ""}`}
    >
      <div className="flex items-center justify-between gap-2 px-3 h-10 border-b border-border bg-muted/30">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
            {index + 1}
          </span>
          <input
            value={slide.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Label — optional"
            className="w-40 bg-transparent border-0 outline-none text-[12px] text-muted-foreground placeholder:text-muted-foreground/35"
          />
          <IconBtn label="Move up" disabled={index === 0} onClick={onMoveUp}>
            <ChevronUp className="size-3.5" />
          </IconBtn>
          <IconBtn label="Move down" disabled={index === total - 1} onClick={onMoveDown}>
            <ChevronDown className="size-3.5" />
          </IconBtn>
        </div>
        <div className="flex items-center gap-1">
          <IconBtn label="Preview" onClick={onPreview}>
            <Eye className="size-3.5" />
          </IconBtn>
          <IconBtn label="Add to queue" onClick={onQueue}>
            <Plus className="size-3.5" />
          </IconBtn>
          <IconBtn label="Go live" onClick={onProject}>
            <Radio className="size-3.5" />
          </IconBtn>
          <span className="w-px h-4 bg-border mx-0.5" />
          <IconBtn label="Delete slide" onClick={onDelete}>
            <Trash2 className="size-3.5 hover:text-destructive" />
          </IconBtn>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        value={slide.lines.join("\n")}
        onChange={(e) => onChange({ lines: e.target.value.split("\n") })}
        placeholder="Lyrics…"
        rows={Math.max(2, slide.lines.length)}
        className="w-full resize-none bg-transparent border-0 outline-none px-4 py-3 font-serif text-[17px] leading-8 placeholder:text-muted-foreground/35"
      />
    </div>
  )
}

function IconBtn({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  label: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className="size-7 grid place-items-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}
