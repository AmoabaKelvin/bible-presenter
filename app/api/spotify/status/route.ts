import {
  getFreshSpotifySession,
  spotifyFetch,
  toPublicSpotifyStatusSession,
} from "@/lib/spotify-auth"

export const runtime = "nodejs"

export async function GET() {
  try {
    const session = await getFreshSpotifySession()
    if (!session) {
      return Response.json({ connected: false })
    }

    const profile = await spotifyFetch("/me")
    if (!profile.ok) {
      return Response.json({
        connected: true,
        session: toPublicSpotifyStatusSession(session),
        profile: null,
      })
    }

    return Response.json({
      connected: true,
      session: toPublicSpotifyStatusSession(session),
      profile: await profile.json(),
    })
  } catch (err) {
    console.error("Spotify status failed", err)
    return Response.json({ connected: false, error: "Failed to read Spotify status." }, { status: 500 })
  }
}
