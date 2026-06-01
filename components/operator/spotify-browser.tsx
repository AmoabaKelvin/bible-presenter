"use client"

import { useState } from "react"
import {
  Loader2,
  ListMusic,
  Music2,
  Search as SearchIcon,
  X,
  LogOut,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { disconnectSpotify, type SpotifyAuthStatus } from "@/lib/spotify-music"
import { useSpotifyPlaylists } from "@/hooks/use-spotify-playlists"
import { useSpotifySearch } from "@/hooks/use-spotify-search"
import {
  formatPlaylistTrackCount,
  type SpotifyMeProfile,
  type SpotifyPlaylistSummary,
} from "./spotify-browser-types"
import { SpotifyBrowseItem, SpotifySection, SpotifyTabButton } from "./spotify-browser-ui"
import { SpotifyPlaylistDetail } from "./spotify-playlist-detail"

interface SpotifyBrowserProps {
  status: SpotifyAuthStatus
  activeUri?: string
  onStatusChange: (status: SpotifyAuthStatus) => void
  onLoadSpotify: (uri: string, options?: { contextUri?: string; offsetUri?: string }) => void
}

type Tab = "playlists" | "search"

export function SpotifyBrowser({
  status,
  activeUri,
  onStatusChange,
  onLoadSpotify,
}: SpotifyBrowserProps) {
  const [tab, setTab] = useState<Tab>("playlists")
  const [disconnecting, setDisconnecting] = useState(false)
  // Drill-in: the playlist whose tracks are currently being browsed.
  const [openPlaylist, setOpenPlaylist] = useState<SpotifyPlaylistSummary | null>(null)
  const profile = status.profile as SpotifyMeProfile | undefined
  const {
    playlists,
    loading: playlistsLoading,
    error: playlistsError,
    resetPlaylists,
  } = useSpotifyPlaylists(tab === "playlists")
  const {
    query,
    setQuery,
    debouncedQuery,
    visibleTracks,
    visibleAlbums,
    visiblePlaylists,
    totalHits: totalSearchHits,
    loading: searchLoading,
    error: searchError,
    resetSearch,
  } = useSpotifySearch(tab === "search")

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await disconnectSpotify()
      onStatusChange({ connected: false })
      resetPlaylists()
      resetSearch()
      setOpenPlaylist(null)
    } catch (err) {
      console.error("Spotify disconnect failed", err)
    } finally {
      setDisconnecting(false)
    }
  }

  const handleLoad = (uri: string, options?: { contextUri?: string; offsetUri?: string }) => {
    // Always send. The operator auto-opens the output window if it's
    // not running; the slideshow tab picks up the queued command on
    // mount, so click never feels broken.
    onLoadSpotify(uri, options)
  }

  // Spotify only lets an unapproved app read the items of playlists the
  // user owns or collaborates on. For everything else we can only play
  // the whole thing, so don't offer a drill-in affordance.
  const myId = profile?.id
  const canDrillIn = (pl: SpotifyPlaylistSummary) =>
    !!myId && (pl.owner?.id === myId || pl.collaborative === true)

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Account strip */}
      <div className="px-3 py-2 border-b border-border/60 flex items-center gap-2">
        {profile?.images?.[0]?.url ? (
          <img
            src={profile.images[0].url}
            alt=""
            className="size-5 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="size-5 rounded-full bg-[#1DB954] grid place-items-center shrink-0">
            <Music2 className="size-2.5 text-white" />
          </div>
        )}
        <span className="text-[11px] text-muted-foreground truncate flex-1">
          {profile?.display_name || "Spotify connected"}
        </span>
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
        >
          <LogOut className="size-2.5" />
          {disconnecting ? "…" : "Disconnect"}
        </button>
      </div>

      {openPlaylist ? (
        <SpotifyPlaylistDetail
          playlist={openPlaylist}
          activeUri={activeUri}
          onBack={() => setOpenPlaylist(null)}
          onPlayAll={() => handleLoad(openPlaylist.uri)}
          onPlayTrack={(trackUri) =>
            handleLoad(trackUri, { contextUri: openPlaylist.uri, offsetUri: trackUri })
          }
        />
      ) : (
        <>
          <div className="flex border-b border-border/60">
            <SpotifyTabButton active={tab === "playlists"} onClick={() => setTab("playlists")}>
              <ListMusic className="size-3 mr-1.5" />
              Playlists
            </SpotifyTabButton>
            <SpotifyTabButton active={tab === "search"} onClick={() => setTab("search")}>
              <SearchIcon className="size-3 mr-1.5" />
              Search
            </SpotifyTabButton>
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
                  You don&rsquo;t have any playlists yet.
                </p>
              )}
              <ul className="px-1 py-1 space-y-0.5">
                {playlists.map((pl) => {
                  const drillable = canDrillIn(pl)
                  return (
                    <SpotifyBrowseItem
                      key={pl.id}
                      title={pl.name}
                      subtitle={formatPlaylistTrackCount(pl)}
                      imageUrl={pl.images?.[0]?.url}
                      fallback={<ListMusic className="size-3 text-muted-foreground" />}
                      isActive={activeUri === pl.uri}
                      variant={drillable ? "open" : "play"}
                      onClick={() => (drillable ? setOpenPlaylist(pl) : handleLoad(pl.uri))}
                    />
                  )
                })}
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
                    placeholder="Search tracks, albums, playlists"
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
                {!searchLoading && !searchError && debouncedQuery && totalSearchHits === 0 && (
                  <p className="text-[11px] text-muted-foreground px-3 py-3">
                    Nothing matched &ldquo;{debouncedQuery}&rdquo;.
                  </p>
                )}
                {!debouncedQuery && (
                  <p className="text-[11px] text-muted-foreground px-3 py-3">
                    Type to search Spotify&rsquo;s catalog.
                  </p>
                )}

                {visibleTracks.length > 0 && (
                  <SpotifySection title="Tracks">
                    {visibleTracks.map((t) => (
                      <SpotifyBrowseItem
                        key={t.id}
                        title={t.name}
                        subtitle={t.artists?.map((a) => a.name).join(", ") || ""}
                        imageUrl={t.album?.images?.[0]?.url}
                        fallback={<Music2 className="size-3 text-muted-foreground" />}
                        isActive={activeUri === t.uri}
                        onClick={() => handleLoad(t.uri)}
                      />
                    ))}
                  </SpotifySection>
                )}
                {visiblePlaylists.length > 0 && (
                  <SpotifySection title="Playlists">
                    {visiblePlaylists.map((pl) => {
                      const drillable = canDrillIn(pl)
                      return (
                        <SpotifyBrowseItem
                          key={pl.id}
                          title={pl.name}
                          subtitle={formatPlaylistTrackCount(pl)}
                          imageUrl={pl.images?.[0]?.url}
                          fallback={<ListMusic className="size-3 text-muted-foreground" />}
                          isActive={activeUri === pl.uri}
                          variant={drillable ? "open" : "play"}
                          onClick={() => (drillable ? setOpenPlaylist(pl) : handleLoad(pl.uri))}
                        />
                      )
                    })}
                  </SpotifySection>
                )}
                {visibleAlbums.length > 0 && (
                  <SpotifySection title="Albums">
                    {visibleAlbums.map((al) => (
                      <SpotifyBrowseItem
                        key={al.id}
                        title={al.name}
                        subtitle={al.artists?.map((a) => a.name).join(", ") || ""}
                        imageUrl={al.images?.[0]?.url}
                        fallback={<Music2 className="size-3 text-muted-foreground" />}
                        isActive={activeUri === al.uri}
                        onClick={() => handleLoad(al.uri)}
                      />
                    ))}
                  </SpotifySection>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
