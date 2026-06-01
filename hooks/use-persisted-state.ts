"use client"

import { useEffect, useState } from "react"
import { readLegacyJson, readLegacyString, readPersisted, writePersisted } from "@/lib/persistence"

export function usePersistedState<T>(key: string, initialValue: T) {
  const [loaded, setLoaded] = useState(false)
  const [value, setValue] = useState<T>(initialValue)

  useEffect(() => {
    try {
      const stored = readPersisted<T>(key, {
        legacy: {
          keys: [key],
          read: () =>
            typeof initialValue === "string"
              ? (readLegacyString(key) as T | null)
              : readLegacyJson<T>(key),
        },
      })
      if (stored !== null) setValue(stored)
    } catch {
      // ignore corrupt local state
    }
    setLoaded(true)
  }, [initialValue, key])

  useEffect(() => {
    if (!loaded) return
    writePersisted(key, value)
  }, [key, loaded, value])

  return [value, setValue] as const
}
