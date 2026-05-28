"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Loader2,
  ListMusic,
  Music2,
  Search as SearchIcon,
  X,
  LogOut,
  Play,
  ChevronRight,
  ChevronLeft,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  disconnectSpotify,
  getSpotifyPlaylists,
  getSpotifyPlaylistItems,
  searchSpotify,
  type SpotifyAuthStatus,
} from "@/lib/spotify-music"

interface SpotifyImage {
  url: string
}

interface SpotifyPlaylistSummary {
  id: string
  name: string
  owner?: { id?: string; display_name?: string }
  collaborative?: boolean
  images?: SpotifyImage[]
  tracks?: { total?: number }
  trackCount?: number
  uri: string
}

interface SpotifyTrackResult {
  id: string
  name: string
  uri: string
  album?: { name?: string; images?: SpotifyImage[] }
  artists?: { name: string }[]
}

interface SpotifyAlbumResult {
  id: string
  name: string
  uri: string
  images?: SpotifyImage[]
  artists?: { name: string }[]
}

interface SearchResponse {
  tracks?: { items?: SpotifyTrackResult[] }
  albums?: { items?: SpotifyAlbumResult[] }
  playlists?: { items?: SpotifyPlaylistSummary[] }
}

interface SpotifyMeProfile {
  id?: string
  display_name?: string
  images?: { url: string }[]
}

interface SpotifyPlaylistItemTrack {
  id: string
  name: string
  uri: string
  artists?: { name: string }[]
  album?: { images?: SpotifyImage[] }
}

interface SpotifyPlaylistItemRow {
  item?: SpotifyPlaylistItemTrack | null
}

interface SpotifyBrowserProps {
  status: SpotifyAuthStatus
  slideshowOnline: boolean
  activeUri?: string
  onStatusChange: (status: SpotifyAuthStatus) => void
  onLoadSpotify: (uri: string, options?: { contextUri?: string; offsetUri?: string }) => void
}

type Tab = "playlists" | "search"

export function SpotifyBrowser({
  status,
  slideshowOnline,
  activeUri,
  onStatusChange,
  onLoadSpotify,
}: SpotifyBrowserProps) {
  const [tab, setTab] = useState<Tab>("playlists")
  const [playlists, setPlaylists] = useState<SpotifyPlaylistSummary[] | null>(null)
  const [playlistsLoading, setPlaylistsLoading] = useState(false)
  const [playlistsError, setPlaylistsError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  // Drill-in: the playlist whose tracks are currently being browsed.
  const [openPlaylist, setOpenPlaylist] = useState<SpotifyPlaylistSummary | null>(null)
  const profile = status.profile as SpotifyMeProfile | undefined

  const searchAbortRef = useRef<AbortController | null>(null)

  // Lazy-load playlists when the playlists tab is shown
  useEffect(() => {
    if (tab !== "playlists") return
    if (playlists !== null) return
    let cancelled = false
    setPlaylistsLoading(true)
    setPlaylistsError(null)
    getSpotifyPlaylists({ limit: 50, all: true })
      .then((data: { items?: SpotifyPlaylistSummary[] }) => {
        if (cancelled) return
        setPlaylists(data.items ?? [])
      })
      .catch((err) => {
        if (cancelled) return
        setPlaylistsError(err.message || "Failed to load playlists.")
        setPlaylists([])
      })
      .finally(() => {
        if (!cancelled) setPlaylistsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab, playlists])

  // Debounce search input
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(handle)
  }, [query])

  // Run search when debounced query changes
  useEffect(() => {
    if (tab !== "search") return
    if (!debouncedQuery) {
      setSearchResults(null)
      setSearchError(null)
      return
    }
    searchAbortRef.current?.abort()
    const controller = new AbortController()
    searchAbortRef.current = controller
    setSearchLoading(true)
    setSearchError(null)
    searchSpotify(debouncedQuery, { type: "track,album,playlist", limit: 6 })
      .then((data) => {
        if (controller.signal.aborted) return
        setSearchResults(data as SearchResponse)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setSearchError(err.message || "Search failed.")
      })
      .finally(() => {
        if (!controller.signal.aborted) setSearchLoading(false)
      })
    return () => controller.abort()
  }, [debouncedQuery, tab])

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await disconnectSpotify()
      onStatusChange({ connected: false })
      setPlaylists(null)
      setSearchResults(null)
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

  const visibleTracks = searchResults?.tracks?.items?.filter(Boolean) ?? []
  const visibleAlbums = searchResults?.albums?.items?.filter(Boolean) ?? []
  const visiblePlaylists = searchResults?.playlists?.items?.filter(Boolean) ?? []
  const totalSearchHits = visibleTracks.length + visibleAlbums.length + visiblePlaylists.length

  const filteredPlaylists = useMemo(() => playlists?.filter(Boolean) ?? [], [playlists])

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
        <PlaylistDetail
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
      {/* Tabs */}
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
          {!playlistsLoading && !playlistsError && filteredPlaylists.length === 0 && (
            <p className="text-[11px] text-muted-foreground px-3 py-3">
              You don&rsquo;t have any playlists yet.
            </p>
          )}
          <ul className="px-1 py-1 space-y-0.5">
            {filteredPlaylists.map((pl) => {
              const drillable = canDrillIn(pl)
              return (
                <BrowseItem
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
              <Section title="Tracks">
                {visibleTracks.map((t) => (
                  <BrowseItem
                    key={t.id}
                    title={t.name}
                    subtitle={t.artists?.map((a) => a.name).join(", ") || ""}
                    imageUrl={t.album?.images?.[0]?.url}
                    fallback={<Music2 className="size-3 text-muted-foreground" />}
                    isActive={activeUri === t.uri}
                    onClick={() => handleLoad(t.uri)}
                  />
                ))}
              </Section>
            )}
            {visiblePlaylists.length > 0 && (
              <Section title="Playlists">
                {visiblePlaylists.map((pl) => {
                  const drillable = canDrillIn(pl)
                  return (
                    <BrowseItem
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
              </Section>
            )}
            {visibleAlbums.length > 0 && (
              <Section title="Albums">
                {visibleAlbums.map((al) => (
                  <BrowseItem
                    key={al.id}
                    title={al.name}
                    subtitle={al.artists?.map((a) => a.name).join(", ") || ""}
                    imageUrl={al.images?.[0]?.url}
                    fallback={<Music2 className="size-3 text-muted-foreground" />}
                    isActive={activeUri === al.uri}
                    onClick={() => handleLoad(al.uri)}
                  />
                ))}
              </Section>
            )}
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}

function getPlaylistTrackCount(playlist: SpotifyPlaylistSummary) {
  if (typeof playlist.trackCount === "number") return playlist.trackCount
  if (typeof playlist.tracks?.total === "number") return playlist.tracks.total
  return null
}

function formatPlaylistTrackCount(playlist: SpotifyPlaylistSummary) {
  const count = getPlaylistTrackCount(playlist)
  if (count === null) return "Playlist"
  return `${count} track${count === 1 ? "" : "s"}`
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pt-2 pb-1">
      <p className="eyebrow px-3 mb-1">{title}</p>
      <ul className="px-1 space-y-0.5">{children}</ul>
    </div>
  )
}

function BrowseItem({
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
  fallback: React.ReactNode
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

interface PlaylistDetailProps {
  playlist: SpotifyPlaylistSummary
  activeUri?: string
  onBack: () => void
  onPlayAll: () => void
  onPlayTrack: (trackUri: string) => void
}

function PlaylistDetail({
  playlist,
  activeUri,
  onBack,
  onPlayAll,
  onPlayTrack,
}: PlaylistDetailProps) {
  const [items, setItems] = useState<SpotifyPlaylistItemRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setForbidden(false)
    setItems(null)
    getSpotifyPlaylistItems(playlist.id, { limit: 100 })
      .then((data: { items?: SpotifyPlaylistItemRow[] }) => {
        if (cancelled) return
        setItems(data.items ?? [])
      })
      .catch((err: Error & { status?: number }) => {
        if (cancelled) return
        if (err.status === 403) setForbidden(true)
        else setError(err.message || "Failed to load tracks.")
        setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [playlist.id])

  const tracks = (items ?? [])
    .map((row) => row.item)
    .filter((t): t is SpotifyPlaylistItemTrack => !!t && !!t.uri)

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-2 py-2 border-b border-border/60 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="size-7 grid place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
          aria-label="Back to playlists"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-medium truncate leading-tight" title={playlist.name}>
            {playlist.name}
          </p>
          <p className="text-[10px] text-muted-foreground truncate leading-tight">
            {formatPlaylistTrackCount(playlist)}
          </p>
        </div>
        <Button size="sm" className="h-7 px-2.5 text-xs shrink-0" onClick={onPlayAll}>
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
        {forbidden && (
          <div className="px-3 py-4 text-center space-y-2.5">
            <p className="text-[11.5px] text-muted-foreground leading-relaxed">
              Spotify only lets the app open the tracks of playlists you own or collaborate
              on. This one belongs to someone else — but you can still play the whole thing.
            </p>
            <Button size="sm" className="h-7 text-xs" onClick={onPlayAll}>
              <Play className="size-3 mr-1" />
              Play all
            </Button>
          </div>
        )}
        {!loading && !error && !forbidden && tracks.length === 0 && (
          <p className="text-[11px] text-muted-foreground px-3 py-3">This playlist is empty.</p>
        )}
        <ul className="px-1 py-1 space-y-0.5">
          {tracks.map((track, i) => (
            <li key={`${track.id}-${i}`}>
              <button
                type="button"
                onClick={() => onPlayTrack(track.uri)}
                className={`group w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors text-left ${
                  activeUri === track.uri ? "bg-foreground/[0.06]" : "hover:bg-accent/60"
                }`}
              >
                <span className="font-mono text-[10px] text-muted-foreground w-5 tabular-nums shrink-0 text-right">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="size-8 rounded-sm bg-accent shrink-0 overflow-hidden grid place-items-center">
                  {track.album?.images?.[0]?.url ? (
                    <img src={track.album.images[0].url} alt="" className="size-full object-cover" />
                  ) : (
                    <Music2 className="size-3 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[12px] truncate ${
                      activeUri === track.uri ? "font-medium text-foreground" : "text-foreground/85"
                    }`}
                    title={track.name}
                  >
                    {track.name}
                  </p>
                  <p className="text-[10.5px] text-muted-foreground truncate">
                    {track.artists?.map((a) => a.name).join(", ") || ""}
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
