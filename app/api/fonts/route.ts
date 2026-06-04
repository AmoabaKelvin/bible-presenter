export const runtime = "nodejs"
// Catalog changes rarely; let the platform cache it for a day.
export const revalidate = 86400

// fonts.google.com's own (keyless) metadata feed lists every family. We proxy
// it server-side because the upstream sends no CORS header, then hand the
// client just the family names to search. Offline, the client falls back to
// the bundled curated list — so this endpoint only matters when online.
const METADATA_URL = "https://fonts.google.com/metadata/fonts"

interface FontMetadata {
  familyMetadataList?: { family?: string }[]
}

export async function GET() {
  try {
    const res = await fetch(METADATA_URL, {
      headers: { accept: "application/json" },
      next: { revalidate },
    })
    if (!res.ok) {
      return Response.json({ error: "Upstream font catalog unavailable." }, { status: 502 })
    }
    // Some Google JSON endpoints prefix an anti-JSON-hijacking token.
    const text = (await res.text()).replace(/^\)\]\}'\s*/, "")
    const data = JSON.parse(text) as FontMetadata
    const families = (data.familyMetadataList ?? [])
      .map((f) => f.family)
      .filter((name): name is string => Boolean(name))

    return Response.json(
      { families },
      { headers: { "cache-control": "public, max-age=86400, stale-while-revalidate=604800" } },
    )
  } catch {
    return Response.json({ error: "Failed to load font catalog." }, { status: 502 })
  }
}
