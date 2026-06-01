export const SCHEMA_VERSION = 1
export const STORAGE_PREFIX = "flowcast"

// Durable content keys (queue, notes, media, history, background, settings)
// are user data. Workspace keys (`workspace:*`) restore the operator console's
// local context after refresh. Cross-tab protocols such as projector output,
// music commands, and heartbeats intentionally live outside this module.

type PersistedRecord<T> = {
  schemaVersion: number
  data: T
}

type LegacyMigration<T> = {
  keys: string[]
  read: () => T | null
}

type SchemaMigration = (data: unknown) => unknown

const migratedKeys = new Set<string>()
const schemaMigrations: Record<number, SchemaMigration> = {}

function storageKey(key: string) {
  return `${STORAGE_PREFIX}:${key}`
}

function versionedStorageKey(key: string, version: number) {
  return `${STORAGE_PREFIX}:v${version}:${key}`
}

function parseJson<T>(raw: string | null): T | null {
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function normalizeRecord(raw: string | null): PersistedRecord<unknown> | null {
  if (raw === null) return null
  const record = parseJson<PersistedRecord<unknown>>(raw)
  if (
    !record ||
    typeof record.schemaVersion !== "number" ||
    !("data" in record)
  ) {
    return null
  }
  return record
}

function migrateSchema<T>(key: string, record: PersistedRecord<unknown>): T | null {
  if (record.schemaVersion > SCHEMA_VERSION) return null

  let data = record.data
  for (let version = record.schemaVersion; version < SCHEMA_VERSION; version++) {
    const migrate = schemaMigrations[version]
    if (!migrate) return null
    data = migrate(data)
  }

  if (record.schemaVersion !== SCHEMA_VERSION) writePersisted(key, data as T)
  return data as T
}

function readRecord<T>(key: string): T | null {
  const raw = localStorage.getItem(storageKey(key))
  const record = normalizeRecord(raw)
  if (!record) return null
  return migrateSchema<T>(key, record)
}

function migrateVersionedPrefix<T>(key: string): T | null {
  for (let version = SCHEMA_VERSION; version >= 1; version--) {
    const oldKey = versionedStorageKey(key, version)
    const record = normalizeRecord(localStorage.getItem(oldKey))
    if (!record) continue

    const data = migrateSchema<T>(key, record)
    if (data === null) return null
    // Write the stable key ourselves: migrateSchema only rewrites on a version
    // change, so a same-version prefix move would otherwise delete the old key
    // without persisting anywhere a read-only consumer can find it.
    writePersisted(key, data)
    localStorage.removeItem(oldKey)
    return data
  }
  return null
}

function migrateLegacy<T>(key: string, migration?: LegacyMigration<T>): T | null {
  if (!migration || migratedKeys.has(key)) return null
  migratedKeys.add(key)

  const data = migration.read()
  if (data === null) return null

  writePersisted(key, data)
  migration.keys.forEach((legacyKey) => localStorage.removeItem(legacyKey))
  return data
}

export function readPersisted<T>(
  key: string,
  options?: { legacy?: LegacyMigration<T> },
): T | null {
  if (typeof localStorage === "undefined") return null
  return readRecord<T>(key) ?? migrateVersionedPrefix<T>(key) ?? migrateLegacy(key, options?.legacy)
}

export function writePersisted<T>(key: string, data: T) {
  if (typeof localStorage === "undefined") return
  const record: PersistedRecord<T> = { schemaVersion: SCHEMA_VERSION, data }
  localStorage.setItem(storageKey(key), JSON.stringify(record))
}

export function removePersisted(key: string) {
  if (typeof localStorage === "undefined") return
  localStorage.removeItem(storageKey(key))
}

export function readLegacyJson<T>(key: string): T | null {
  return parseJson<T>(localStorage.getItem(key))
}

export function readLegacyString(key: string): string | null {
  return localStorage.getItem(key)
}
