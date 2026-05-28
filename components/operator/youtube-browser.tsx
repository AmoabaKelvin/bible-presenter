"use client"

import { useEffect, useRef, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  ListMusic,
  Loader2,
  LogOut,
  Play,
  Search as SearchIcon,
  X,
  Youtube,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  disconnectYouTube,
  getYouTubePlaylistItems,
  getYouTubePlaylists,
  searchYouTube,
  type YouTubeAuthStatus,
  type YouTubePlaylistSummary,
  type YouTubePlaylistTrack,
} from "@/lib/youtube-account"

interface YouTubeChannelResponse {
  items?: {
    snippet?: {
      title?: string
      thumbnails?: Record<string, { url?: string }>
    }
  }[]
}

interface YouTubeBrowserProps {
  status: YouTubeAuthStatus
  activeVideoId?: string
  activePlaylistId?: string
  onStatusChange: (status: YouTubeAuthStatus) => void
  onLoadPlaylist: (playlist: YouTubePlaylistSummary) => void
  onLoadTrack: (track: YouTubePlaylistTrack, playlist: YouTubePlaylistSummary, index: number) => void
  onLoadVideo: (track: YouTubePlaylistTrack) => void
}

type Tab = "playlists" | "search"

export function YouTubeBrowser({
  status,
  activeVideoId,
  activePlaylistId,
  onStatusChange,
  onLoadPlaylist,
  onLoadTrack,
  onLoadVideo,
}: YouTubeBrowserProps) {
  const [tab, setTab] = useState<Tab>("playlists")
  const [playlists, setPlaylists] = useState<YouTubePlaylistSummary[] | null>(null)
  const [playlistsLoading, setPlaylistsLoading] = useState(false)
  const [playlistsError, setPlaylistsError] = useState<string | null>(null)
  const [openPlaylist, setOpenPlaylist] = useState<YouTubePlaylistSummary | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [results, setResults] = useState<YouTubePlaylistTrack[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)
  const channel = status.channel as YouTubeChannelResponse | undefined
  const channelSnippet = channel?.items?.[0]?.snippet

  useEffect(() => {
    if (tab !== "playlists") return
    if (playlists !== null) return
    let cancelled = false
    setPlaylistsLoading(true)
    setPlaylistsError(null)
    getYouTubePlaylists({ limit: 50, all: true })
      .then((data) => {
        if (!cancelled) setPlaylists(data.items ?? [])
      })
      .catch((err) => {
        if (cancelled) return
        setPlaylistsError(err.message || "Failed to load YouTube playlists.")
        setPlaylists([])
      })
      .finally(() => {
        if (!cancelled) setPlaylistsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab, playlists])

  // Debounce the search query — search.list is 100 quota units per call.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 450)
    return () => clearTimeout(handle)
  }, [query])

  useEffect(() => {
    if (tab !== "search") return
    if (!debouncedQuery) {
      setResults(null)
      setSearchError(null)
      return
    }
    searchAbortRef.current?.abort()
    const controller = new AbortController()
    searchAbortRef.current = controller
    setSearchLoading(true)
    setSearchError(null)
    searchYouTube(debouncedQuery, { limit: 12, signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return
        setResults(data.items ?? [])
      })
      .catch((err: Error & { status?: number }) => {
        if (controller.signal.aborted || err.name === "AbortError") return
        setSearchError(
          err.status === 403
            ? "YouTube search quota is exhausted for today."
            : err.message || "Search failed.",
        )
        setResults([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setSearchLoading(false)
      })
    return () => controller.abort()
  }, [debouncedQuery, tab])

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await disconnectYouTube()
      onStatusChange({ connected: false })
      setPlaylists(null)
      setOpenPlaylist(null)
      setResults(null)
      setQuery("")
    } catch (err) {
      console.error("YouTube disconnect failed", err)
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-3 py-2 border-b border-border/60 flex items-center gap-2">
        {channelSnippet?.thumbnails?.default?.url ? (
          <img
            src={channelSnippet.thumbnails.default.url}
            alt=""
            className="size-5 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="size-5 rounded-full bg-[#ff0033] grid place-items-center shrink-0">
            <Youtube className="size-2.5 text-white" />
          </div>
        )}
        <span className="text-[11px] text-muted-foreground truncate flex-1">
          {channelSnippet?.title || "YouTube connected"}
        </span>
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
        >
          <LogOut className="size-2.5" />
          {disconnecting ? "..." : "Disconnect"}
        </button>
      </div>

      {openPlaylist ? (
        <YouTubePlaylistDetail
          playlist={openPlaylist}
          activeVideoId={activeVideoId}
          onBack={() => setOpenPlaylist(null)}
          onPlayAll={() => onLoadPlaylist(openPlaylist)}
          onPlayTrack={(track, index) => onLoadTrack(track, openPlaylist, index)}
        />
      ) : (
        <>
          <div className="flex border-b border-border/60">
            <TabButton active={tab === "playlists"} onClick={() => setTab("playlists")}>
              <ListMusic className="size-3 mr-1.5" />
              Playlists
            </TabButton>
            <TabButton active={tab === "search"} onClick={() => setTab("search")}>
              <SearchIcon className="size-3 mr-1.5" />
              Search
            </TabButton>
          </div>

          {tab === "playlists" ? (
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scroll-thin">
              {playlistsLoading && (
                <div className="grid place-items-center py-8">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {playlistsError && (
                <p className="text-[11px] text-destructive px-3 py-3">{playlistsError}</p>
              )}
              {!playlistsLoading && !playlistsError && (playlists?.length ?? 0) === 0 && (
                <p className="text-[11px] text-muted-foreground px-3 py-3">
                  No YouTube playlists were returned for this account.
                </p>
              )}
              <ul className="px-1 py-1 space-y-0.5">
                {(playlists ?? []).map((playlist) => (
                  <BrowseItem
                    key={playlist.id}
                    title={playlist.title}
                    subtitle={formatPlaylistCount(playlist)}
                    imageUrl={playlist.thumbnailUrl}
                    isActive={activePlaylistId === playlist.playlistId}
                    onClick={() => setOpenPlaylist(playlist)}
                  />
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="px-3 py-2 border-b border-border/60">
                <div className="relative">
                  <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search YouTube"
                    className="h-8 pl-8 pr-8 text-sm"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 size-5 grid place-items-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent"
                      aria-label="Clear"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scroll-thin">
                {searchLoading && (
                  <div className="grid place-items-center py-6">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {searchError && (
                  <p className="text-[11px] text-destructive px-3 py-3">{searchError}</p>
                )}
                {!debouncedQuery && !searchLoading && (
                  <p className="text-[11px] text-muted-foreground px-3 py-3">
                    Search YouTube for a song or video to play.
                  </p>
                )}
                {!searchLoading && !searchError && debouncedQuery && (results?.length ?? 0) === 0 && (
                  <p className="text-[11px] text-muted-foreground px-3 py-3">
                    Nothing matched &ldquo;{debouncedQuery}&rdquo;.
                  </p>
                )}
                <ul className="px-1 py-1 space-y-0.5">
                  {(results ?? []).map((track, i) => (
                    <li key={`${track.videoId}-${i}`}>
                      <button
                        type="button"
                        onClick={() => onLoadVideo(track)}
                        className={`group w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors text-left ${
                          activeVideoId === track.videoId ? "bg-foreground/[0.06]" : "hover:bg-accent/60"
                        }`}
                      >
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
                              activeVideoId === track.videoId
                                ? "font-medium text-foreground"
                                : "text-foreground/85"
                            }`}
                            title={track.title}
                          >
                            {track.title}
                          </p>
                          <p className="text-[10.5px] text-muted-foreground truncate">
                            {track.author || ""}
                          </p>
                        </div>
                        {activeVideoId === track.videoId ? (
                          <span className="text-[9px] font-mono uppercase tracking-wider text-[color:var(--live)] shrink-0">
                            Now
                          </span>
                        ) : (
                          <Play className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
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

function YouTubePlaylistDetail({
  playlist,
  activeVideoId,
  onBack,
  onPlayAll,
  onPlayTrack,
}: {
  playlist: YouTubePlaylistSummary
  activeVideoId?: string
  onBack: () => void
  onPlayAll: () => void
  onPlayTrack: (track: YouTubePlaylistTrack, index: number) => void
}) {
  const [tracks, setTracks] = useState<YouTubePlaylistTrack[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setTracks(null)
    getYouTubePlaylistItems(playlist.playlistId, { limit: 50, all: true })
      .then((data) => {
        if (!cancelled) setTracks(data.items ?? [])
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message || "Failed to load tracks.")
        setTracks([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [playlist.playlistId])

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-2 py-2 border-b border-border/60 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="size-7 grid place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
          aria-label="Back to YouTube playlists"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-medium truncate leading-tight" title={playlist.title}>
            {playlist.title}
          </p>
          <p className="text-[10px] text-muted-foreground truncate leading-tight">
            {formatPlaylistCount(playlist)}
          </p>
        </div>
        <Button
          size="sm"
          className="h-7 px-2.5 text-xs shrink-0"
          onClick={() => {
            const firstTrack = tracks?.[0]
            if (firstTrack) onPlayTrack(firstTrack, 0)
            else onPlayAll()
          }}
        >
          <Play className="size-3 mr-1" />
          Play all
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scroll-thin">
        {loading && (
          <div className="grid place-items-center py-8">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && <p className="text-[11px] text-destructive px-3 py-3">{error}</p>}
        {!loading && !error && (tracks?.length ?? 0) === 0 && (
          <p className="text-[11px] text-muted-foreground px-3 py-3">This playlist is empty.</p>
        )}
        <ul className="px-1 py-1 space-y-0.5">
          {(tracks ?? []).map((track, i) => (
            <li key={`${track.id}-${i}`}>
              <button
                type="button"
                onClick={() => onPlayTrack(track, i)}
                className={`group w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors text-left ${
                  activeVideoId === track.videoId ? "bg-foreground/[0.06]" : "hover:bg-accent/60"
                }`}
              >
                <span className="font-mono text-[10px] text-muted-foreground w-5 tabular-nums shrink-0 text-right">
                  {String(i + 1).padStart(2, "0")}
                </span>
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
                      activeVideoId === track.videoId ? "font-medium text-foreground" : "text-foreground/85"
                    }`}
                    title={track.title}
                  >
                    {track.title}
                  </p>
                  <p className="text-[10.5px] text-muted-foreground truncate">
                    {track.author || playlist.channelTitle || ""}
                  </p>
                </div>
                <Play className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function BrowseItem({
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
          <p className={`text-[12px] truncate ${isActive ? "font-medium text-foreground" : "text-foreground/85"}`} title={title}>
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

function formatPlaylistCount(playlist: YouTubePlaylistSummary) {
  if (typeof playlist.itemCount !== "number") return "Playlist"
  return `${playlist.itemCount} video${playlist.itemCount === 1 ? "" : "s"}`
}
