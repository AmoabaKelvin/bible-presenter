// Video bytes are never copied into storage. Instead we persist the
// FileSystemFileHandle the user picked (handles are structured-cloneable into
// IndexedDB) and re-derive an object URL on demand by reading the file off disk.
// A separate database keeps these handles out of the image blob store; the
// `vidh-` id prefix lets callers distinguish a handle id from an image id.

const DB_NAME = "flowcastHandles"
const STORE = "handles"
const DB_VERSION = 1
const HANDLE_PREFIX = "vidh-"

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

// True for ids produced by storeFileHandle, so image-store can route to the
// handle path without importing this module's internals everywhere.
export function isHandleId(id: string | null | undefined): boolean {
  return !!id && id.startsWith(HANDLE_PREFIX)
}

export async function storeFileHandle(handle: FileSystemFileHandle): Promise<string> {
  const id = `${HANDLE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).put(handle, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  return id
}

export async function getFileHandle(id: string): Promise<FileSystemFileHandle | undefined> {
  try {
    const db = await openDb()
    return await new Promise<FileSystemFileHandle | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly")
      const req = tx.objectStore(STORE).get(id)
      req.onsuccess = () => resolve(req.result as FileSystemFileHandle | undefined)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return undefined
  }
}

export async function removeFileHandle(id: string | null | undefined): Promise<void> {
  if (!id) return
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite")
      tx.objectStore(STORE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // ignore
  }
}

// Check (and optionally request) read access to a stored handle. Requesting
// must happen from a user gesture; querying is always safe. Returns "granted"
// in environments lacking the permission methods so resolution can proceed.
export async function ensureReadPermission(
  handle: FileSystemFileHandle,
  { request }: { request: boolean },
): Promise<PermissionState> {
  if (typeof handle.queryPermission !== "function") return "granted"
  const current = await handle.queryPermission({ mode: "read" })
  if (current === "granted" || !request) return current
  if (typeof handle.requestPermission !== "function") return current
  return handle.requestPermission({ mode: "read" })
}

// Per-document cache of id → object URL, mirroring image-store so repeated
// renders reuse one URL within a tab.
const urlCache = new Map<string, string>()

// Resolve a handle id to a renderable URL. When the handle exists but read
// permission isn't granted yet, returns { needsPermission: true } so the caller
// can surface a user-gesture prompt (the projector lacks a gesture on load).
export async function resolveHandleMedia(
  id: string,
  { request }: { request: boolean },
): Promise<{ url: string; kind: "video" } | { needsPermission: true } | null> {
  const cached = urlCache.get(id)
  if (cached) return { url: cached, kind: "video" }
  const handle = await getFileHandle(id)
  if (!handle) return null
  try {
    const permission = await ensureReadPermission(handle, { request })
    if (permission !== "granted") return { needsPermission: true }
    const file = await handle.getFile()
    const url = URL.createObjectURL(file)
    urlCache.set(id, url)
    return { url, kind: "video" }
  } catch {
    return null
  }
}
