"use client"

import { ChevronRight, ListMusic, Play, Youtube } from "lucide-react"
import type { ReactNode } from "react"
import type { YouTubePlaylistTrack } from "@/lib/youtube-account"

export function YouTubeTabButton({
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

export function YouTubePlaylistItem({
  title,
  subtitle,
  imageUrl,
  isActive,
  onClick,
}: {
  title: string
  subtitle: string
  imageUrl?: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`group w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors text-left ${
          isActive ? "bg-foreground/[0.06]" : "hover:bg-accent/60"
        }`}
      >
        <div className="size-8 rounded-sm bg-accent shrink-0 overflow-hidden grid place-items-center">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="size-full object-cover" />
          ) : (
            <ListMusic className="size-3 text-muted-foreground" />
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
          <p className="text-[10.5px] text-muted-foreground truncate" title={subtitle}>
            {subtitle}
          </p>
        </div>
        <ChevronRight className="size-3.5 text-muted-foreground/70 group-hover:text-foreground transition-colors shrink-0" />
      </button>
    </li>
  )
}

export function YouTubeTrackItem({
  track,
  active,
  subtitle,
  index,
  onClick,
}: {
  track: YouTubePlaylistTrack
  active: boolean
  subtitle: string
  index?: number
  onClick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`group w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors text-left ${
          active ? "bg-foreground/[0.06]" : "hover:bg-accent/60"
        }`}
      >
        {typeof index === "number" && (
          <span className="font-mono text-[10px] text-muted-foreground w-5 tabular-nums shrink-0 text-right">
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
        <div className="size-8 rounded-sm bg-accent shrink-0 overflow-hidden grid place-items-center">
          {track.thumbnailUrl ? (
            <img src={track.thumbnailUrl} alt="" className="size-full object-cover" />
          ) : (
            <Youtube className="size-3 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={`text-[12px] truncate ${
              active ? "font-medium text-foreground" : "text-foreground/85"
            }`}
            title={track.title}
          >
            {track.title}
          </p>
          <p className="text-[10.5px] text-muted-foreground truncate">{subtitle}</p>
        </div>
        {active && typeof index !== "number" ? (
          <span className="text-[9px] font-mono uppercase tracking-wider text-[color:var(--live)] shrink-0">
            Now
          </span>
        ) : (
          <Play className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        )}
      </button>
    </li>
  )
}
