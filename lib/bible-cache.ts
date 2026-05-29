// Downloaded Bible translations live in IndexedDB so chapters and search
// indexes survive reloads and work offline. Three stores keep concerns apart:
// "chapters" holds verse arrays per chapter, "meta" tracks per-version
// download state, and "indexes" stores serialized MiniSearch payloads.

export type ChapterVerse = { number: number; text: string }
export type VersionMeta = { code: string; downloadedAt: number; chapterCount: number; complete: boolean }

const DB_NAME = "flowwwwBible"
const DB_VERSION = 1
const CHAPTERS = "chapters"
const META = "meta"
const INDEXES = "indexes"

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
      const db = req.result
      if (!db.objectStoreNames.contains(CHAPTERS)) db.createObjectStore(CHAPTERS)
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META)
      if (!db.objectStoreNames.contains(INDEXES)) db.createObjectStore(INDEXES)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function chapterKey(version: string, book: string, chapter: number): string {
  return `${version}:${book}:${chapter}`
}

function put<T>(store: string, key: string, value: T): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, "readwrite")
        tx.objectStore(store).put(value, key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }),
  )
}

function get<T>(store: string, key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(store, "readonly")
        const req = tx.objectStore(store).get(key)
        req.onsuccess = () => resolve(req.result as T | undefined)
        req.onerror = () => reject(req.error)
      }),
  )
}

export async function getCachedChapter(
  version: string,
  book: string,
  chapter: number,
): Promise<ChapterVerse[] | null> {
  try {
    const verses = await get<ChapterVerse[]>(CHAPTERS, chapterKey(version, book, chapter))
    return verses ?? null
  } catch {
    return null
  }
}

export async function putCachedChapter(
  version: string,
  book: string,
  chapter: number,
  verses: ChapterVerse[],
): Promise<void> {
  await put(CHAPTERS, chapterKey(version, book, chapter), verses)
}

export async function getVersionMeta(version: string): Promise<VersionMeta | null> {
  try {
    const meta = await get<VersionMeta>(META, version)
    return meta ?? null
  } catch {
    return null
  }
}

export async function setVersionMeta(version: string, meta: VersionMeta): Promise<void> {
  await put(META, version, meta)
}

export async function listDownloadedVersions(): Promise<VersionMeta[]> {
  try {
    const db = await openDb()
    return await new Promise<VersionMeta[]>((resolve, reject) => {
      const tx = db.transaction(META, "readonly")
      const req = tx.objectStore(META).getAll()
      req.onsuccess = () => resolve(req.result as VersionMeta[])
      req.onerror = () => reject(req.error)
    })
  } catch {
    return []
  }
}

// Remove every chapter for a version (keys are prefixed `${version}:`), plus
// its meta record and serialized search index.
export async function deleteVersion(version: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([CHAPTERS, META, INDEXES], "readwrite")
    const chapters = tx.objectStore(CHAPTERS)
    const range = IDBKeyRange.bound(`${version}:`, `${version}:￿`)
    chapters.openKeyCursor(range).onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursor | null>).result
      if (cursor) {
        chapters.delete(cursor.key)
        cursor.continue()
      }
    }
    tx.objectStore(META).delete(version)
    tx.objectStore(INDEXES).delete(version)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function putSearchIndex(version: string, json: string): Promise<void> {
  await put(INDEXES, version, json)
}

export async function getSearchIndex(version: string): Promise<string | null> {
  try {
    const json = await get<string>(INDEXES, version)
    return json ?? null
  } catch {
    return null
  }
}
