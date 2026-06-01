"use client"

import { useState } from "react"
import {
  ListMusic,
  Loader2,
  LogOut,
  Search as SearchIcon,
  X,
  Youtube,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  disconnectYouTube,
  type YouTubeAuthStatus,
  type YouTubePlaylistSummary,
  type YouTubePlaylistTrack,
} from "@/lib/youtube-account"
import { useYouTubePlaylists } from "@/hooks/use-youtube-playlists"
import { useYouTubeSearch } from "@/hooks/use-youtube-search"
import {
  formatYouTubePlaylistCount,
  type YouTubeChannelResponse,
} from "./youtube-browser-types"
import {
  YouTubePlaylistItem,
  YouTubeTabButton,
  YouTubeTrackItem,
} from "./youtube-browser-ui"
import { YouTubePlaylistDetail } from "./youtube-playlist-detail"

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
  const [openPlaylist, setOpenPlaylist] = useState<YouTubePlaylistSummary | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const channel = status.channel as YouTubeChannelResponse | undefined
  const channelSnippet = channel?.items?.[0]?.snippet
  const {
    playlists,
    loading: playlistsLoading,
    error: playlistsError,
    resetPlaylists,
  } = useYouTubePlaylists(tab === "playlists")
  const {
    query,
    setQuery,
    debouncedQuery,
    results,
    loading: searchLoading,
    error: searchError,
    resetSearch,
  } = useYouTubeSearch(tab === "search")

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await disconnectYouTube()
      onStatusChange({ connected: false })
      resetPlaylists()
      setOpenPlaylist(null)
      resetSearch()
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
            <YouTubeTabButton active={tab === "playlists"} onClick={() => setTab("playlists")}>
              <ListMusic className="size-3 mr-1.5" />
              Playlists
            </YouTubeTabButton>
            <YouTubeTabButton active={tab === "search"} onClick={() => setTab("search")}>
              <SearchIcon className="size-3 mr-1.5" />
              Search
            </YouTubeTabButton>
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
              {!playlistsLoading && !playlistsError && playlists.length === 0 && (
                <p className="text-[11px] text-muted-foreground px-3 py-3">
                  No YouTube playlists were returned for this account.
                </p>
              )}
              <ul className="px-1 py-1 space-y-0.5">
                {playlists.map((playlist) => (
                  <YouTubePlaylistItem
                    key={playlist.id}
                    title={playlist.title}
                    subtitle={formatYouTubePlaylistCount(playlist)}
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
                {!searchLoading && !searchError && debouncedQuery && results.length === 0 && (
                  <p className="text-[11px] text-muted-foreground px-3 py-3">
                    Nothing matched &ldquo;{debouncedQuery}&rdquo;.
                  </p>
                )}
                <ul className="px-1 py-1 space-y-0.5">
                  {results.map((track, i) => (
                    <YouTubeTrackItem
                      key={`${track.videoId}-${i}`}
                      track={track}
                      active={activeVideoId === track.videoId}
                      subtitle={track.author || ""}
                      onClick={() => onLoadVideo(track)}
                    />
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
