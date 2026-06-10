// The "shows" feature: save / restore / export / import a full operator state
// snapshot. A SavedShow lives in the local show library (durable persistence
// under the "shows" key); its snapshot only references background imageIds, so
// the library stays small and localStorage-friendly. The embedded media lives
// in IndexedDB (image-store) and is only inlined when EXPORTING to a portable
// `.flowshow` file, then re-stored under fresh ids on IMPORT.

import type { SavedShow, ShowSnapshot } from "@/components/operator/types"
import type { SelectedVerse } from "@/components/slide-stage"
import {
  normalizeBackgroundConfig,
  type BackgroundConfig,
  type BackgroundLayer,
} from "@/lib/background-config"
import { mergePresentation } from "@/lib/presentation-settings"
import { getStoredImageBlob, storeImage } from "@/lib/image-store"
import { readPersisted, writePersisted } from "@/lib/persistence"

const SHOWS_KEY = "shows"
const FLOWSHOW_FORMAT = "flowshow"
const FLOWSHOW_VERSION = 1

// The portable export envelope. Background media bytes are inlined as base64 so
// the file is self-contained and works on another machine.
export interface FlowShowFile {
  format: typeof FLOWSHOW_FORMAT
  version: number
  name: string
  savedAt: number
  snapshot: ShowSnapshot
  media: Record<string, { dataBase64: string; mime: string; kind: "image" | "video" }>
}

// ── Snapshot normalization ─────────────────────────────────────────────────

function normalizeVerses(value: unknown): SelectedVerse[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is SelectedVerse => !!v && typeof v === "object")
}

// Defensively coerce an arbitrary value into a valid ShowSnapshot, tolerating
// older/partial shapes without throwing.
export function normalizeSnapshot(value: unknown): ShowSnapshot {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>
  const cursor = typeof raw.queueCursor === "number" ? raw.queueCursor : -1
  return {
    queue: normalizeVerses(raw.queue),
    queueCursor: cursor,
    liveVerses: normalizeVerses(raw.liveVerses),
    version: typeof raw.version === "string" ? raw.version : "KJV",
    presentation: mergePresentation(raw.presentation as never),
    background: normalizeBackgroundConfig(raw.background),
  }
}

function normalizeShow(value: unknown): SavedShow | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Record<string, unknown>
  if (typeof raw.id !== "string") return null
  const now = Date.now()
  return {
    id: raw.id,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : "Untitled show",
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : now,
    snapshot: normalizeSnapshot(raw.snapshot),
  }
}

// ── Library CRUD (durable persistence) ──────────────────────────────────────

function readLibrary(): SavedShow[] {
  const stored = readPersisted<unknown[]>(SHOWS_KEY)
  if (!Array.isArray(stored)) return []
  return stored.map(normalizeShow).filter((s): s is SavedShow => s !== null)
}

function writeLibrary(shows: SavedShow[]) {
  writePersisted(SHOWS_KEY, shows)
}

function newId() {
  return `show-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Most-recently-updated first.
export function listShows(): SavedShow[] {
  return readLibrary().sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getShow(id: string): SavedShow | undefined {
  return readLibrary().find((s) => s.id === id)
}

export function saveShow(name: string, snapshot: ShowSnapshot): SavedShow {
  const now = Date.now()
  const show: SavedShow = {
    id: newId(),
    name: name.trim() || "Untitled show",
    createdAt: now,
    updatedAt: now,
    snapshot: normalizeSnapshot(snapshot),
  }
  writeLibrary([show, ...readLibrary()])
  return show
}

export function renameShow(id: string, name: string): void {
  const next = name.trim()
  if (!next) return
  writeLibrary(
    readLibrary().map((s) =>
      s.id === id ? { ...s, name: next, updatedAt: Date.now() } : s,
    ),
  )
}

export function deleteShow(id: string): void {
  writeLibrary(readLibrary().filter((s) => s.id !== id))
}

// Add an already-built show (e.g. from import) to the library.
function addShow(show: SavedShow): SavedShow {
  writeLibrary([show, ...readLibrary().filter((s) => s.id !== show.id)])
  return show
}

// ── Background media walking ─────────────────────────────────────────────────

const BG_KEYS = ["default", "scripture", "song", "note", "definition"] as const

function eachLayer(config: BackgroundConfig): BackgroundLayer[] {
  const layers: BackgroundLayer[] = []
  for (const key of BG_KEYS) {
    const layer = config[key]
    if (layer) layers.push(layer)
  }
  return layers
}

// Distinct imageIds referenced by any layer in the config.
function collectImageIds(config: BackgroundConfig): string[] {
  const ids = new Set<string>()
  for (const layer of eachLayer(config)) {
    if (layer.imageId) ids.add(layer.imageId)
  }
  return Array.from(ids)
}

// Rewrite every layer's imageId through a remap (old id → new id). Layers whose
// id is missing from the map (e.g. media that failed to re-store) are cleared
// back to a plain color layer so the show still restores cleanly.
function remapBackgroundIds(
  config: BackgroundConfig,
  remap: Record<string, string>,
): BackgroundConfig {
  const mapLayer = (layer: BackgroundLayer): BackgroundLayer => {
    if (!layer.imageId) return layer
    const next = remap[layer.imageId]
    if (next) return { ...layer, imageId: next }
    return { ...layer, imageId: null, kind: null }
  }
  const result: BackgroundConfig = { default: mapLayer(config.default) }
  for (const key of ["scripture", "song", "note", "definition"] as const) {
    const layer = config[key]
    if (layer) result[key] = mapLayer(layer)
  }
  return result
}

// ── base64 <-> Blob (browser, chunked to avoid call-stack limits) ────────────

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

// ── Export ───────────────────────────────────────────────────────────────────

// Produce a self-contained `.flowshow` JSON blob: the snapshot plus every
// referenced background blob inlined as base64.
export async function exportShow(show: SavedShow): Promise<Blob> {
  const ids = collectImageIds(show.snapshot.background)
  const media: FlowShowFile["media"] = {}
  await Promise.all(
    ids.map(async (id) => {
      const blob = await getStoredImageBlob(id)
      if (!blob) return // missing media is skipped; restore falls back to color
      media[id] = {
        dataBase64: await blobToBase64(blob),
        mime: blob.type || "application/octet-stream",
        kind: blob.type.startsWith("video/") ? "video" : "image",
      }
    }),
  )
  const file: FlowShowFile = {
    format: FLOWSHOW_FORMAT,
    version: FLOWSHOW_VERSION,
    name: show.name,
    savedAt: Date.now(),
    snapshot: show.snapshot,
    media,
  }
  return new Blob([JSON.stringify(file)], { type: "application/json" })
}

// A filesystem-safe filename for an exported show.
export function exportFileName(show: SavedShow): string {
  const slug = show.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return `${slug || "show"}.flowshow`
}

// ── Import ───────────────────────────────────────────────────────────────────

// Parse + validate a `.flowshow` file, re-store its embedded media under fresh
// IndexedDB ids, remap the snapshot's background to those ids, and add the
// result to the library. Tolerates partial/legacy files without throwing.
export async function importShowFile(file: File): Promise<SavedShow> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error("This file is not a valid .flowshow file.")
  }
  const raw = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>
  if (raw.format !== FLOWSHOW_FORMAT) {
    throw new Error("This file is not a FlowCast show.")
  }
  if (typeof raw.version === "number" && raw.version > FLOWSHOW_VERSION) {
    throw new Error("This show was exported by a newer version of FlowCast.")
  }

  const snapshot = normalizeSnapshot(raw.snapshot)

  // Re-store each embedded blob, building old-id → new-id remap.
  const remap: Record<string, string> = {}
  const media = (raw.media && typeof raw.media === "object" ? raw.media : {}) as Record<
    string,
    { dataBase64?: unknown; mime?: unknown }
  >
  await Promise.all(
    Object.entries(media).map(async ([oldId, entry]) => {
      if (!entry || typeof entry.dataBase64 !== "string") return
      const mime = typeof entry.mime === "string" ? entry.mime : "application/octet-stream"
      try {
        const blob = base64ToBlob(entry.dataBase64, mime)
        remap[oldId] = await storeImage(blob)
      } catch {
        // skip undecodable media; the layer falls back to its color
      }
    }),
  )

  const remappedBackground = remapBackgroundIds(snapshot.background, remap)
  const now = Date.now()
  const show: SavedShow = {
    id: newId(),
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : "Imported show",
    createdAt: now,
    updatedAt: now,
    snapshot: { ...snapshot, background: remappedBackground },
  }
  return addShow(show)
}
