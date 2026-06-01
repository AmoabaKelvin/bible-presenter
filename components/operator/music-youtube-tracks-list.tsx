"use client"

import { Music } from "lucide-react"
import type { OEmbedTrack } from "@/lib/youtube-oembed"

interface YouTubeTracksListProps {
  videoIds: string[]
  activeIndex?: number
  tracks: Record<string, OEmbedTrack | null>
  playing: boolean
  onPlayAt: (i: number) => void
}

export function YouTubeTracksList({
  videoIds,
  activeIndex,
  tracks,
  playing,
  onPlayAt,
}: YouTubeTracksListProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scroll-thin">
      <ul className="px-2 py-2 space-y-0.5">
        {videoIds.map((videoId, i) => {
          const track = tracks[videoId]
          const isActive = activeIndex === i
          return (
            <li
              key={`${videoId}-${i}`}
              onClick={() => onPlayAt(i)}
              className={`group relative flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                isActive ? "bg-foreground/[0.06]" : "hover:bg-accent/60"
              }`}
            >
              <span
                aria-hidden
                className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full ${
                  isActive ? "bg-[color:var(--live)]" : "bg-transparent"
                }`}
              />
              <span className="font-mono text-[10px] text-muted-foreground w-5 tabular-nums shrink-0 text-right">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="size-8 rounded-sm bg-accent grid place-items-center shrink-0 overflow-hidden">
                {track?.thumbnailUrl ? (
                  <img src={track.thumbnailUrl} alt="" className="size-full object-cover" />
                ) : (
                  <Music className="size-3 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-[12px] truncate ${
                    isActive ? "font-medium text-foreground" : "text-foreground/85"
                  }`}
                  title={track?.title}
                >
                  {track?.title || videoId}
                </p>
                {track?.author && (
                  <p className="text-[10.5px] text-muted-foreground truncate">{track.author}</p>
                )}
              </div>
              {isActive && (
                <span className="text-[9px] font-mono uppercase tracking-wider text-[color:var(--live)] shrink-0">
                  {playing ? "Now" : "Cued"}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
