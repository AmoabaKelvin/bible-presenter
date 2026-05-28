import {
  consumeYouTubeLoginState,
  consumeYouTubeReturnTo,
  exchangeYouTubeCode,
  writeYouTubeSession,
} from "@/lib/youtube-auth"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const state = requestUrl.searchParams.get("state")
  const error = requestUrl.searchParams.get("error")
  const returnTo = await consumeYouTubeReturnTo()

  if (error) {
    return Response.redirect(withYouTubeStatus(returnTo, requestUrl.origin, "error"))
  }

  const validState = await consumeYouTubeLoginState(state)
  if (!code || !validState) {
    return Response.json({ error: "Invalid YouTube authorization callback." }, { status: 400 })
  }

  try {
    const session = await exchangeYouTubeCode(code, requestUrl)
    await writeYouTubeSession(session)
    return Response.redirect(withYouTubeStatus(returnTo, requestUrl.origin, "connected"))
  } catch (err) {
    console.error("YouTube callback failed", err)
    return Response.json({ error: "Failed to connect YouTube." }, { status: 500 })
  }
}

function withYouTubeStatus(returnTo: string, origin: string, status: string) {
  const url = new URL(returnTo, origin)
  url.searchParams.set("youtube", status)
  return url
}
