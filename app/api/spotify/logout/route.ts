import { clearSpotifySession } from "@/lib/spotify-auth"

export const runtime = "nodejs"

export async function POST() {
  await clearSpotifySession()
  return Response.json({ ok: true })
}

export async function GET(request: Request) {
  await clearSpotifySession()
  return Response.redirect(new URL("/", request.url))
}
