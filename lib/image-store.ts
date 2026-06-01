// Image bytes live in IndexedDB (large quota, shared across same-origin
// tabs); localStorage and the projection payload only carry small ids.
// Each tab resolves an id to its own object URL via resolveImageUrl().

const DB_NAME = "flowcastImages"
const STORE = "images"
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function putBlob(id: string, blob: Blob): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite")
        tx.objectStore(STORE).put(blob, id)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }),
  )
}

function getBlob(id: string): Promise<Blob | undefined> {
  return openDb().then(
    (db) =>
      new Promise<Blob | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly")
        const req = tx.objectStore(STORE).get(id)
        req.onsuccess = () => resolve(req.result as Blob | undefined)
        req.onerror = () => reject(req.error)
      }),
  )
}

export function getStoredImageBlob(id: string | null | undefined): Promise<Blob | undefined> {
  if (!id || isDirectUrl(id)) return Promise.resolve(undefined)
  return getBlob(id)
}

function deleteBlob(id: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite")
        tx.objectStore(STORE).delete(id)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }),
  )
}

// Per-document cache of id → object URL so repeated renders reuse one URL.
const urlCache = new Map<string, string>()

function isDirectUrl(value: string) {
  return (
    value.startsWith("data:") ||
    value.startsWith("blob:") ||
    value.startsWith("http://") ||
    value.startsWith("https://")
  )
}

// Store an uploaded file and return its id. Seeds the URL cache so the
// uploading tab can render it immediately without a round-trip.
export async function storeImage(file: Blob): Promise<string> {
  const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await putBlob(id, file)
  urlCache.set(id, URL.createObjectURL(file))
  return id
}

function canvasToBlob(canvas: OffscreenCanvas | HTMLCanvasElement, type: string, quality: number) {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type, quality })
  }
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
}

export async function createImageThumbnailBlob(
  source: Blob,
  maxDimension = 480,
): Promise<Blob | null> {
  if (!source.type.startsWith("image/")) return null

  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(source)
    const largestSide = Math.max(bitmap.width, bitmap.height)
    if (largestSide <= maxDimension && source.size <= 180_000) return source

    const scale = Math.min(1, maxDimension / largestSide)
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(width, height)
        : Object.assign(document.createElement("canvas"), { width, height })
    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    ctx.drawImage(bitmap, 0, 0, width, height)
    return await canvasToBlob(canvas, "image/webp", 0.82)
  } catch {
    return null
  } finally {
    bitmap?.close()
  }
}

export async function storeImageThumbnail(source: Blob): Promise<string | null> {
  const thumbnail = await createImageThumbnailBlob(source)
  if (!thumbnail) return null
  return storeImage(thumbnail)
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl)
  return response.blob()
}

// Resolve an id (or a legacy/direct URL) to a renderable URL.
export async function resolveImageUrl(id: string | null | undefined): Promise<string | null> {
  if (!id) return null
  if (isDirectUrl(id)) return id // legacy data URLs / remote URLs pass through
  const cached = urlCache.get(id)
  if (cached) return cached
  try {
    const blob = await getBlob(id)
    if (!blob) return null
    const url = URL.createObjectURL(blob)
    urlCache.set(id, url)
    return url
  } catch {
    return null
  }
}

export type BackgroundMediaKind = "image" | "video"

// Resolve a background id (or direct URL) to both a renderable URL and its
// media kind, derived from the stored Blob's MIME type. This lets the
// slideshow render <video> vs CSS background without a separate flag.
export async function resolveBackgroundMedia(
  id: string | null | undefined,
): Promise<{ url: string; kind: BackgroundMediaKind } | null> {
  if (!id) return null
  if (id.startsWith("data:")) {
    const mime = id.slice(5, id.indexOf(";"))
    return { url: id, kind: mime.startsWith("video/") ? "video" : "image" }
  }
  if (isDirectUrl(id)) return { url: id, kind: "image" } // unknown type — assume image
  try {
    const blob = await getBlob(id)
    if (!blob) return null
    const cached = urlCache.get(id)
    const url = cached ?? URL.createObjectURL(blob)
    if (!cached) urlCache.set(id, url)
    return { url, kind: blob.type.startsWith("video/") ? "video" : "image" }
  } catch {
    return null
  }
}

export async function removeImage(id: string | null | undefined): Promise<void> {
  if (!id || isDirectUrl(id)) return
  const url = urlCache.get(id)
  if (url) {
    URL.revokeObjectURL(url)
    urlCache.delete(id)
  }
  try {
    await deleteBlob(id)
  } catch {
    // ignore
  }
}
