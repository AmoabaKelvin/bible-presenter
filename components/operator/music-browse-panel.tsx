"use client"

import { useEffect, useState, type ReactNode } from "react"
import { ExternalLink, Music2, Youtube } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getSpotifyLoginUrl, type SpotifyAuthStatus } from "@/lib/spotify-music"
import {
  getYouTubeLoginUrl,
  type YouTubeAuthStatus,
  type YouTubePlaylistSummary,
  type YouTubePlaylistTrack,
} from "@/lib/youtube-account"
import { SpotifyBrowser } from "./spotify-browser"
import { YouTubeBrowser } from "./youtube-browser"

interface MusicBrowsePanelProps {
  loaded: boolean
  slideshowOnline: boolean
  youtubeStatus: YouTubeAuthStatus
  spotifyStatus: SpotifyAuthStatus
  activeYouTubeVideoId?: string
  activeYouTubePlaylistId?: string
  activeSpotifyUri?: string
  onOpenOutput: () => void
  onYouTubeStatusChange: (status: YouTubeAuthStatus) => void
  onSpotifyStatusChange: (status: SpotifyAuthStatus) => void
  onLoadYouTubePlaylist: (playlist: YouTubePlaylistSummary) => void
  onLoadYouTubeTrack: (
    track: YouTubePlaylistTrack,
    playlist: YouTubePlaylistSummary,
    index: number,
  ) => void
  onLoadYouTubeVideo: (track: YouTubePlaylistTrack) => void
  onLoadSpotify: (uri: string, options?: { contextUri?: string; offsetUri?: string }) => void
}

export function MusicBrowsePanel({
  loaded,
  slideshowOnline,
  youtubeStatus,
  spotifyStatus,
  activeYouTubeVideoId,
  activeYouTubePlaylistId,
  activeSpotifyUri,
  onOpenOutput,
  onYouTubeStatusChange,
  onSpotifyStatusChange,
  onLoadYouTubePlaylist,
  onLoadYouTubeTrack,
  onLoadYouTubeVideo,
  onLoadSpotify,
}: MusicBrowsePanelProps) {
  const [browseProvider, setBrowseProvider] = useState<"youtube" | "spotify">("youtube")

  useEffect(() => {
    if (!youtubeStatus.connected && spotifyStatus.connected) setBrowseProvider("spotify")
    else if (youtubeStatus.connected && !spotifyStatus.connected) setBrowseProvider("youtube")
  }, [youtubeStatus.connected, spotifyStatus.connected])

  if (!youtubeStatus.connected && !spotifyStatus.connected) {
    return (
      <EmptyBrowse
        slideshowOnline={slideshowOnline}
        loaded={loaded}
        onOpenOutput={onOpenOutput}
      />
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex border-b border-border/60">
        <SourceButton active={browseProvider === "youtube"} onClick={() => setBrowseProvider("youtube")}>
          <Youtube className="size-3 mr-1.5" />
          YouTube
        </SourceButton>
        <SourceButton active={browseProvider === "spotify"} onClick={() => setBrowseProvider("spotify")}>
          <Music2 className="size-3 mr-1.5" />
          Spotify
        </SourceButton>
      </div>
      {browseProvider === "youtube" ? (
        youtubeStatus.connected ? (
          <YouTubeBrowser
            status={youtubeStatus}
            activeVideoId={activeYouTubeVideoId}
            activePlaylistId={activeYouTubePlaylistId}
            onStatusChange={onYouTubeStatusChange}
            onLoadPlaylist={onLoadYouTubePlaylist}
            onLoadTrack={onLoadYouTubeTrack}
            onLoadVideo={onLoadYouTubeVideo}
          />
        ) : (
          <ConnectPanel provider="youtube" loaded={loaded} />
        )
      ) : spotifyStatus.connected ? (
        <SpotifyBrowser
          status={spotifyStatus}
          activeUri={activeSpotifyUri}
          onStatusChange={onSpotifyStatusChange}
          onLoadSpotify={onLoadSpotify}
        />
      ) : (
        <ConnectPanel provider="spotify" loaded={loaded} />
      )}
    </div>
  )
}

interface EmptyBrowseProps {
  slideshowOnline: boolean
  loaded: boolean
  onOpenOutput: () => void
}

function EmptyBrowse({ slideshowOnline, loaded, onOpenOutput }: EmptyBrowseProps) {
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-6 text-center gap-3">
      {!slideshowOnline ? (
        <>
          <p className="text-[11.5px] text-muted-foreground leading-relaxed">
            Open the output window first — music plays in the slideshow tab.
          </p>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onOpenOutput}>
            <ExternalLink className="size-3 mr-1.5" />
            Open output
          </Button>
        </>
      ) : (
        <>
          <div className="space-y-1">
            <p className="text-[12px] font-medium">
              {loaded ? "Connect an account to browse" : "Connect music"}
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[280px]">
              Link YouTube or Spotify to browse account playlists and play them in the output window.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-8 text-xs bg-[#ff0033] hover:bg-[#ff0033]/90 text-white" asChild>
              <a href={getYouTubeLoginUrl(typeof window === "undefined" ? "/" : window.location.pathname)}>
                <Youtube className="size-3 mr-1.5" />
                Connect YouTube
              </a>
            </Button>
            <Button size="sm" className="h-8 text-xs bg-[#1DB954] hover:bg-[#1DB954]/90 text-white" asChild>
              <a href={getSpotifyLoginUrl(typeof window === "undefined" ? "/" : window.location.pathname)}>
                <Music2 className="size-3 mr-1.5" />
                Connect Spotify
              </a>
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function SourceButton({
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

function ConnectPanel({ provider, loaded }: { provider: "youtube" | "spotify"; loaded: boolean }) {
  const isYouTube = provider === "youtube"
  const href = isYouTube
    ? getYouTubeLoginUrl(typeof window === "undefined" ? "/" : window.location.pathname)
    : getSpotifyLoginUrl(typeof window === "undefined" ? "/" : window.location.pathname)

  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-6 text-center gap-3">
      <div className={`size-10 rounded-full grid place-items-center ${isYouTube ? "bg-[#ff0033]/10" : "bg-[#1DB954]/10"}`}>
        {isYouTube ? (
          <Youtube className="size-4 text-[#ff0033]" />
        ) : (
          <Music2 className="size-4 text-[#1DB954]" />
        )}
      </div>
      <div className="space-y-1">
        <p className="text-[12px] font-medium">
          {loaded ? `Connect ${isYouTube ? "YouTube" : "Spotify"} to browse` : `Connect ${isYouTube ? "YouTube" : "Spotify"}`}
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[260px]">
          {isYouTube
            ? "Link your Google account to browse official YouTube playlists."
            : "Link your Spotify account to browse playlists and search Spotify's catalog."}
        </p>
      </div>
      <Button
        size="sm"
        className={`h-8 text-xs text-white ${isYouTube ? "bg-[#ff0033] hover:bg-[#ff0033]/90" : "bg-[#1DB954] hover:bg-[#1DB954]/90"}`}
        asChild
      >
        <a href={href}>
          {isYouTube ? <Youtube className="size-3 mr-1.5" /> : <Music2 className="size-3 mr-1.5" />}
          Connect {isYouTube ? "YouTube" : "Spotify"}
        </a>
      </Button>
    </div>
  )
}
