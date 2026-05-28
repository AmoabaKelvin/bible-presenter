import {
  consumeSpotifyLoginState,
  consumeSpotifyReturnTo,
  exchangeSpotifyCode,
  writeSpotifySession,
} from "@/lib/spotify-auth"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const state = requestUrl.searchParams.get("state")
  const error = requestUrl.searchParams.get("error")
  const returnTo = await consumeSpotifyReturnTo()

  if (error) {
    return Response.redirect(withSpotifyStatus(returnTo, requestUrl.origin, "error"))
  }

  const validState = await consumeSpotifyLoginState(state)
  if (!code || !validState) {
    return Response.json({ error: "Invalid Spotify authorization callback." }, { status: 400 })
  }

  try {
    const session = await exchangeSpotifyCode(code, requestUrl)
    await writeSpotifySession(session)
    return Response.redirect(withSpotifyStatus(returnTo, requestUrl.origin, "connected"))
  } catch (err) {
    console.error("Spotify callback failed", err)
    return Response.json({ error: "Failed to connect Spotify." }, { status: 500 })
  }
}

function withSpotifyStatus(returnTo: string, origin: string, status: string) {
  const url = new URL(returnTo, origin)
  url.searchParams.set("spotify", status)
  return url
}
