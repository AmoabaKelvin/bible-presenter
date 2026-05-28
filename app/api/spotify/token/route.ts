import { getFreshSpotifySession, toPublicSpotifySession } from "@/lib/spotify-auth"

export const runtime = "nodejs"

export async function GET() {
  try {
    const session = await getFreshSpotifySession()
    if (!session) {
      return Response.json({ error: "Spotify is not connected." }, { status: 401 })
    }
    return Response.json(toPublicSpotifySession(session))
  } catch (err) {
    console.error("Spotify token refresh failed", err)
    return Response.json({ error: "Failed to refresh Spotify session." }, { status: 500 })
  }
}
