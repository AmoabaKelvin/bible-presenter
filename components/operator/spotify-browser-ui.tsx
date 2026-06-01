"use client"

import { ChevronRight, Play } from "lucide-react"
import type { ReactNode } from "react"

export function SpotifyTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 inline-flex items-center justify-center h-9 text-[11px] font-mono uppercase tracking-wider transition-colors ${
        active
          ? "text-foreground border-b-2 border-foreground -mb-px"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}

export function SpotifySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="pt-2 pb-1">
      <p className="eyebrow px-3 mb-1">{title}</p>
      <ul className="px-1 space-y-0.5">{children}</ul>
    </div>
  )
}

export function SpotifyBrowseItem({
  title,
  subtitle,
  imageUrl,
  fallback,
  isActive,
  disabled,
  variant = "play",
  onClick,
}: {
  title: string
  subtitle: string
  imageUrl?: string
  fallback: ReactNode
  isActive: boolean
  disabled?: boolean
  variant?: "play" | "open"
  onClick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`group w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed ${
          isActive ? "bg-foreground/[0.06]" : "hover:bg-accent/60"
        }`}
      >
        <div className="size-8 rounded-sm bg-accent shrink-0 overflow-hidden grid place-items-center">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="size-full object-cover" />
          ) : (
            fallback
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={`text-[12px] truncate ${
              isActive ? "font-medium text-foreground" : "text-foreground/85"
            }`}
            title={title}
          >
            {title}
          </p>
          {subtitle && (
            <p className="text-[10.5px] text-muted-foreground truncate" title={subtitle}>
              {subtitle}
            </p>
          )}
        </div>
        {isActive ? (
          <span className="text-[9px] font-mono uppercase tracking-wider text-[color:var(--live)] shrink-0">
            Now
          </span>
        ) : variant === "open" ? (
          <ChevronRight className="size-3.5 text-muted-foreground/70 group-hover:text-foreground transition-colors shrink-0" />
        ) : (
          <Play className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        )}
      </button>
    </li>
  )
}
