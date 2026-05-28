import {
  buildYouTubeAuthorizeUrl,
  makeYouTubeState,
  setYouTubeLoginCookies,
} from "@/lib/youtube-auth"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const state = makeYouTubeState()
  const returnTo = requestUrl.searchParams.get("returnTo") || "/"
  await setYouTubeLoginCookies(state, returnTo)
  return Response.redirect(buildYouTubeAuthorizeUrl(requestUrl, state))
}
