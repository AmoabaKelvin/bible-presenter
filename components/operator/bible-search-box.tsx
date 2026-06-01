"use client"

import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"

interface BibleSearchBoxProps {
  query: string
  onQueryChange: (query: string) => void
}

export function BibleSearchBox({ query, onQueryChange }: BibleSearchBoxProps) {
  return (
    <div className="px-8 pt-6 pb-2 max-w-[1100px] mx-auto w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search the Bible — a word, phrase, or topic"
          className="h-10 pl-10 text-sm"
          autoFocus
        />
        {query && (
          <button
            onClick={() => onQueryChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 size-6 grid place-items-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent"
            aria-label="Clear"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
