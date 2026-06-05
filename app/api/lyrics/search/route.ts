// Song search across the lyrics source chain (LRCLIB → Genius fallback).
// Kept server-side so source secrets (Genius token) never reach the client.

import { searchLyrics } from "@/lib/lyrics-sources"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim()
  if (!q) return Response.json({ error: "Missing search query." }, { status: 400 })

  try {
    const results = await searchLyrics(q)
    return Response.json({ results })
  } catch {
    return Response.json({ error: "Search request failed." }, { status: 502 })
  }
}
