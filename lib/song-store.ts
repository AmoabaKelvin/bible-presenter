// Songs persist in IndexedDB (their own database) so a library of many songs
// scales past the localStorage budget used for smaller operator state.

import type { Song } from "@/components/operator/types"

const DB_NAME = "flowcastSongs"
const DB_VERSION = 1
const SONGS = "songs"

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
      if (!db.objectStoreNames.contains(SONGS)) db.createObjectStore(SONGS)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

export async function getAllSongs(): Promise<Song[]> {
  try {
    const db = await openDb()
    return await new Promise<Song[]>((resolve, reject) => {
      const tx = db.transaction(SONGS, "readonly")
      const req = tx.objectStore(SONGS).getAll()
      req.onsuccess = () => resolve((req.result as Song[]) ?? [])
      req.onerror = () => reject(req.error)
    })
  } catch {
    return []
  }
}

// Run a write against the songs store and resolve once the transaction commits.
async function writeStore(mutate: (store: IDBObjectStore) => void): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SONGS, "readwrite")
    mutate(tx.objectStore(SONGS))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function putSong(song: Song): Promise<void> {
  await writeStore((store) => store.put(song, song.id))
}

export async function deleteSong(id: string): Promise<void> {
  await writeStore((store) => store.delete(id))
}
