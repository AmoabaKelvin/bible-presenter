import { getFreshSpotifySession, spotifyFetch, toPublicSpotifySession } from "@/lib/spotify-auth"

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
        session: toStatusSession(session),
        profile: null,
      })
    }

    return Response.json({
      connected: true,
      session: toStatusSession(session),
      profile: await profile.json(),
    })
  } catch (err) {
    console.error("Spotify status failed", err)
    return Response.json({ connected: false, error: "Failed to read Spotify status." }, { status: 500 })
  }
}

function toStatusSession(session: Parameters<typeof toPublicSpotifySession>[0]) {
  const publicSession = toPublicSpotifySession(session)
  return {
    scope: publicSession.scope,
    expiresAt: publicSession.expiresAt,
    expiresIn: publicSession.expiresIn,
  }
}
