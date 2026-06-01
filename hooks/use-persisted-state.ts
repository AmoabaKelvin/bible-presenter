"use client"

import { useEffect, useState } from "react"

export function usePersistedState<T>(key: string, initialValue: T) {
  const [loaded, setLoaded] = useState(false)
  const [value, setValue] = useState<T>(initialValue)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored !== null) {
        setValue((typeof initialValue === "string" ? stored : JSON.parse(stored)) as T)
      }
    } catch {
      // ignore corrupt local state
    }
    setLoaded(true)
  }, [initialValue, key])

  useEffect(() => {
    if (!loaded) return
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value))
  }, [key, loaded, value])

  return [value, setValue] as const
}
