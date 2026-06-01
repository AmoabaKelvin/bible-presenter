"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  lookup,
  parseSenses,
  preloadDictionary,
  suggest,
  type DictEntry,
} from "@/lib/dictionary"

export interface DictionaryResultRow {
  word: string
  source: DictEntry["source"]
  text: string
  senseNo: number | null
}

function toDictionaryRows(entries: DictEntry[]): DictionaryResultRow[] {
  return entries.flatMap((entry): DictionaryResultRow[] => {
    const senses = parseSenses(entry.definition)
    if (senses.length <= 1) {
      return [
        {
          word: entry.word,
          source: entry.source,
          text: senses[0]?.text ?? entry.definition,
          senseNo: null,
        },
      ]
    }
    return senses.map((sense) => ({
      word: entry.word,
      source: entry.source,
      text: sense.text,
      senseNo: sense.n,
    }))
  })
}

type UseDictionaryLookupOptions = {
  delayMs?: number
  suggestionsLimit?: number
}

export function useDictionaryLookup(
  query: string,
  enabled: boolean,
  options: UseDictionaryLookupOptions = {},
) {
  const [entries, setEntries] = useState<DictEntry[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)
  const trimmedQuery = query.trim()
  const delayMs = options.delayMs ?? 200
  const suggestionsLimit = options.suggestionsLimit ?? 0

  useEffect(() => {
    if (enabled) preloadDictionary()
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    if (trimmedQuery.length < 2) {
      setEntries([])
      setSuggestions([])
      setLoading(false)
      return
    }
    setLoading(true)
    const id = ++requestId.current
    const handle = setTimeout(async () => {
      const [result, suggestionResult] = await Promise.all([
        lookup(trimmedQuery),
        suggestionsLimit > 0 ? suggest(trimmedQuery, suggestionsLimit) : Promise.resolve([]),
      ])
      if (id !== requestId.current) return
      setEntries(result.entries)
      setSuggestions(suggestionResult)
      setLoading(false)
    }, delayMs)
    return () => clearTimeout(handle)
  }, [delayMs, enabled, suggestionsLimit, trimmedQuery])

  return {
    entries,
    rows: useMemo(() => toDictionaryRows(entries), [entries]),
    suggestions,
    loading,
  }
}
