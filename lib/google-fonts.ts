// Curated list of widely-used Google Fonts, bundled so the picker can search
// instantly while offline. Choosing a family loads it live via the css2
// endpoint (see `use-google-font`); offline, the slide falls back to serif.
// Names must match Google's family names exactly so the css2 URL resolves.

export const GOOGLE_FONTS: string[] = [
  // Sans-serif
  "Stack Sans Text",
  "Century Gothic",
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Source Sans 3",
  "Nunito",
  "Nunito Sans",
  "Work Sans",
  "Raleway",
  "Rubik",
  "DM Sans",
  "Mulish",
  "Manrope",
  "Karla",
  "Quicksand",
  "Barlow",
  "Barlow Condensed",
  "Hind",
  "Cabin",
  "Oxygen",
  "PT Sans",
  "Titillium Web",
  "Heebo",
  "Josefin Sans",
  "Assistant",
  "Figtree",
  "Sora",
  "Outfit",
  "Plus Jakarta Sans",
  "Lexend",
  "Public Sans",
  "Albert Sans",
  "Onest",
  "Schibsted Grotesk",
  "Be Vietnam Pro",
  "Red Hat Display",
  "Red Hat Text",
  "Space Grotesk",
  "Epilogue",
  "Urbanist",
  "Jost",
  "Kanit",
  "Prompt",
  "Anton",
  "Oswald",
  "Bebas Neue",
  "Archivo",
  "Archivo Narrow",
  "Archivo Black",
  "Saira",
  "Saira Condensed",
  "Fira Sans",
  "Cairo",
  "Tajawal",
  "IBM Plex Sans",
  "IBM Plex Mono",
  "Noto Sans",
  "Signika",
  "Signika Negative",
  "Catamaran",
  "Chivo",
  "Exo 2",
  "Maven Pro",
  "Overpass",
  "Questrial",
  "Varela Round",
  "Comfortaa",
  "Dosis",
  "Teko",
  "Pathway Gothic One",
  "Fjalla One",
  "Bai Jamjuree",
  "Hanken Grotesk",
  "Instrument Sans",
  "Geist",
  "Wix Madefor Text",

  // Serif
  "Playfair Display",
  "Merriweather",
  "Lora",
  "PT Serif",
  "Noto Serif",
  "Source Serif 4",
  "Crimson Text",
  "Crimson Pro",
  "Libre Baskerville",
  "EB Garamond",
  "Cormorant",
  "Cormorant Garamond",
  "Bitter",
  "Domine",
  "Spectral",
  "Zilla Slab",
  "Frank Ruhl Libre",
  "Vollkorn",
  "Alegreya",
  "Cardo",
  "Neuton",
  "Arvo",
  "Bodoni Moda",
  "Fraunces",
  "Newsreader",
  "Literata",
  "Petrona",
  "DM Serif Display",
  "DM Serif Text",
  "Marcellus",
  "Cinzel",
  "Prata",
  "Tinos",
  "Gelasio",
  "Old Standard TT",
  "Sorts Mill Goudy",
  "Josefin Slab",
  "Rokkitt",
  "Slabo 27px",
  "Roboto Slab",
  "Bree Serif",
  "Aleo",
  "Faustina",
  "STIX Two Text",
  "Noto Serif Display",
  "Instrument Serif",

  // Display / script — useful for titles and reference lines
  "Abril Fatface",
  "Lobster",
  "Pacifico",
  "Dancing Script",
  "Caveat",
  "Sacramento",
  "Great Vibes",
  "Satisfy",
  "Kaushan Script",
  "Yellowtail",
  "Cookie",
  "Allura",
  "Parisienne",
  "Cormorant SC",
  "Alfa Slab One",
  "Righteous",
  "Passion One",
  "Staatliches",
  "Bungee",
  "Russo One",
  "Fredoka",
  "Baloo 2",
  "Chewy",
  "Permanent Marker",
  "Shadows Into Light",
  "Indie Flower",
  "Amatic SC",
  "Patrick Hand",
  "Gloria Hallelujah",
  "Courgette",

  // Monospace
  "Roboto Mono",
  "Space Mono",
  "JetBrains Mono",
  "Source Code Pro",
  "Inconsolata",
  "Fira Code",
  "Ubuntu Mono",
  "PT Mono",
  "Cousine",
  "Overpass Mono",
]

export function searchGoogleFonts(query: string, source: string[] = GOOGLE_FONTS, limit = 60): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return source.slice(0, limit)
  const matches = source.filter((f) => f.toLowerCase().includes(q))
  // Surface prefix matches first — "lo" should show "Lora"/"Lobster" before
  // "Cormorant" (which merely contains the substring).
  matches.sort((a, b) => {
    const ap = a.toLowerCase().startsWith(q) ? 0 : 1
    const bp = b.toLowerCase().startsWith(q) ? 0 : 1
    return ap - bp || a.localeCompare(b)
  })
  return matches.slice(0, limit)
}

// Full Google Fonts catalog, fetched once (when online) via our same-origin
// proxy and merged ahead of the curated list so any family is searchable.
// Memoized so the picker can call it freely; failures resolve to the curated
// list, keeping search usable offline.
let catalogPromise: Promise<string[]> | null = null

export function loadGoogleFontCatalog(): Promise<string[]> {
  if (catalogPromise) return catalogPromise
  catalogPromise = fetch("/api/fonts")
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error("catalog request failed"))))
    .then((data: { families?: string[] }) => {
      const families = Array.isArray(data.families) ? data.families : []
      if (families.length === 0) return GOOGLE_FONTS
      // Curated names first (they're the hand-picked, on-theme defaults), then
      // the rest of the catalog, de-duplicated.
      const seen = new Set(GOOGLE_FONTS)
      return [...GOOGLE_FONTS, ...families.filter((f) => !seen.has(f))]
    })
    .catch(() => {
      // Allow a later retry rather than caching the failure forever.
      catalogPromise = null
      return GOOGLE_FONTS
    })
  return catalogPromise
}
