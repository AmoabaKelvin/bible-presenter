import { getFreshYouTubeSession, toPublicYouTubeSession, youtubeFetch } from "@/lib/youtube-auth"

export const runtime = "nodejs"

export async function GET() {
  try {
    const session = await getFreshYouTubeSession()
    if (!session) return Response.json({ connected: false })

    const channel = await youtubeFetch("/channels?part=snippet&mine=true&maxResults=1")
    if (!channel.ok) {
      return Response.json({
        connected: true,
        session: toStatusSession(session),
        channel: null,
      })
    }

    return Response.json({
      connected: true,
      session: toStatusSession(session),
      channel: await channel.json(),
    })
  } catch (err) {
    console.error("YouTube status failed", err)
    return Response.json({ connected: false, error: "Failed to read YouTube status." }, { status: 500 })
  }
}

function toStatusSession(session: Parameters<typeof toPublicYouTubeSession>[0]) {
  const publicSession = toPublicYouTubeSession(session)
  return {
    scope: publicSession.scope,
    expiresAt: publicSession.expiresAt,
    expiresIn: publicSession.expiresIn,
  }
}
