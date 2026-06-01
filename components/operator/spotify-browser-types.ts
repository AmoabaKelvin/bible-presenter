export interface SpotifyImage {
  url: string
}

export interface SpotifyPlaylistSummary {
  id: string
  name: string
  owner?: { id?: string; display_name?: string }
  collaborative?: boolean
  images?: SpotifyImage[]
  tracks?: { total?: number }
  trackCount?: number
  uri: string
}

export interface SpotifyTrackResult {
  id: string
  name: string
  uri: string
  album?: { name?: string; images?: SpotifyImage[] }
  artists?: { name: string }[]
}

export interface SpotifyAlbumResult {
  id: string
  name: string
  uri: string
  images?: SpotifyImage[]
  artists?: { name: string }[]
}

export interface SearchResponse {
  tracks?: { items?: SpotifyTrackResult[] }
  albums?: { items?: SpotifyAlbumResult[] }
  playlists?: { items?: SpotifyPlaylistSummary[] }
}

export interface SpotifyMeProfile {
  id?: string
  display_name?: string
  images?: { url: string }[]
}

export interface SpotifyPlaylistItemTrack {
  id: string
  name: string
  uri: string
  artists?: { name: string }[]
  album?: { images?: SpotifyImage[] }
}

export interface SpotifyPlaylistItemRow {
  item?: SpotifyPlaylistItemTrack | null
}

export function getPlaylistTrackCount(playlist: SpotifyPlaylistSummary) {
  if (typeof playlist.trackCount === "number") return playlist.trackCount
  if (typeof playlist.tracks?.total === "number") return playlist.tracks.total
  return null
}

export function formatPlaylistTrackCount(playlist: SpotifyPlaylistSummary) {
  const count = getPlaylistTrackCount(playlist)
  if (count === null) return "Playlist"
  return `${count} track${count === 1 ? "" : "s"}`
}
