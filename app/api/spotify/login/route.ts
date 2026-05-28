import {
  buildSpotifyAuthorizeUrl,
  makeSpotifyState,
  setSpotifyLoginCookies,
} from "@/lib/spotify-auth"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const state = makeSpotifyState()
  const returnTo = requestUrl.searchParams.get("returnTo") || "/"
  await setSpotifyLoginCookies(state, returnTo)
  return Response.redirect(buildSpotifyAuthorizeUrl(requestUrl, state))
}
