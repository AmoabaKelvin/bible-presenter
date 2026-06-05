// Fetch full lyrics for a chosen search result, dispatched to its source by
// the (source, ref) pair carried on the result.

import { fetchLyricsForHit } from "@/lib/lyrics-sources"
import type { LyricsSourceName } from "@/lib/lyrics-sources/types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const source = url.searchParams.get("source") as LyricsSourceName | null
  const ref = url.searchParams.get("ref")?.trim()
  if ((source !== "lrclib" && source !== "genius") || !ref) {
    return Response.json({ error: "Missing source or ref." }, { status: 400 })
  }

  try {
    const lyrics = await fetchLyricsForHit(source, ref)
    if (!lyrics) {
      return Response.json({ error: "No lyrics found for this song." }, { status: 404 })
    }
    return Response.json({ lyrics })
  } catch {
    return Response.json({ error: "Lyrics request failed." }, { status: 502 })
  }
}
