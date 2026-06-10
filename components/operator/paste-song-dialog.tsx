"use client"

import { useRef, useState } from "react"
import { Search, Loader2, Music } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  fetchLyricsOnline,
  searchSongsOnline,
  type SongSearchResult,
} from "@/lib/lyrics-api"

interface PasteSongDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (title: string, lyrics: string, linesPerSlide?: number) => void
  onStartBlank: () => void
}

type Tab = "search" | "paste"

export function PasteSongDialog({
  open,
  onOpenChange,
  onCreate,
  onStartBlank,
}: PasteSongDialogProps) {
  const [tab, setTab] = useState<Tab>("search")
  const [title, setTitle] = useState("")
  const [lyrics, setLyrics] = useState("")
  const [linesPerSlide, setLinesPerSlide] = useState("")

  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SongSearchResult[]>([])
  const [searched, setSearched] = useState(false)
  const [searching, setSearching] = useState(false)
  const [fetchingId, setFetchingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const searchAbort = useRef<AbortController | null>(null)
  const lyricsAbort = useRef<AbortController | null>(null)

  const reset = () => {
    searchAbort.current?.abort()
    lyricsAbort.current?.abort()
    setTab("search")
    setTitle("")
    setLyrics("")
    setLinesPerSlide("")
    setQuery("")
    setResults([])
    setSearched(false)
    setSearching(false)
    setFetchingId(null)
    setError(null)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const runSearch = async () => {
    const q = query.trim()
    if (!q) return
    searchAbort.current?.abort()
    const controller = new AbortController()
    searchAbort.current = controller
    setSearching(true)
    setError(null)
    try {
      const found = await searchSongsOnline(q, controller.signal)
      if (controller.signal.aborted) return
      setResults(found)
      setSearched(true)
    } catch (e) {
      if ((e as Error).name === "AbortError") return
      setError((e as Error).message)
    } finally {
      if (!controller.signal.aborted) setSearching(false)
    }
  }

  const pickResult = async (result: SongSearchResult) => {
    lyricsAbort.current?.abort()
    const controller = new AbortController()
    lyricsAbort.current = controller
    setFetchingId(result.id)
    setError(null)
    try {
      const fetched = await fetchLyricsOnline(result, controller.signal)
      if (controller.signal.aborted) return
      setTitle(result.title)
      setLyrics(fetched)
      setTab("paste")
    } catch (e) {
      if ((e as Error).name === "AbortError") return
      setError(`${(e as Error).message} Try another result or paste manually.`)
    } finally {
      if (!controller.signal.aborted) setFetchingId(null)
    }
  }

  const create = () => {
    if (!lyrics.trim()) return
    const n = parseInt(linesPerSlide, 10)
    onCreate(title, lyrics, Number.isInteger(n) && n > 0 ? n : undefined)
    reset()
    onOpenChange(false)
  }

  const startBlank = () => {
    reset()
    onOpenChange(false)
    onStartBlank()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl max-h-[88vh] overflow-hidden flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Add a song</DialogTitle>
          <DialogDescription>
            Search to pull lyrics automatically, or paste them yourself.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="flex-1 min-h-0 flex flex-col">
          <div className="px-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="search">Search</TabsTrigger>
              <TabsTrigger value="paste">Paste lyrics</TabsTrigger>
            </TabsList>
          </div>

          {/* Search */}
          <TabsContent
            value="search"
            className="flex-1 min-h-0 overflow-y-auto scroll-thin px-6 pt-4 pb-2 m-0 animate-in fade-in-0 slide-in-from-left-3 duration-200 ease-out"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    runSearch()
                  }
                }}
                placeholder="Search for a song, then press Enter…"
                className="h-11 pl-10 pr-10"
                autoFocus
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
              )}
            </div>

            <div className="mt-3 min-h-[200px]">
              {results.length > 0 ? (
                <ul className="rounded-md border border-border divide-y divide-border">
                  {results.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => pickResult(r)}
                        disabled={fetchingId !== null}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors disabled:opacity-60"
                      >
                        {r.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.thumbnail} alt="" className="size-10 rounded object-cover shrink-0" />
                        ) : (
                          <span className="size-10 rounded bg-muted grid place-items-center shrink-0">
                            <Music className="size-4 text-muted-foreground" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13.5px] font-medium truncate">{r.title}</span>
                          <span className="block text-[12px] text-muted-foreground truncate">{r.artist}</span>
                        </span>
                        {fetchingId === r.id && (
                          <Loader2 className="size-4 animate-spin text-muted-foreground shrink-0" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="h-full grid place-items-center text-center px-6 py-10">
                  <p className="text-sm text-muted-foreground">
                    {error
                      ? error
                      : searching
                        ? "Searching…"
                        : searched
                          ? "No songs found. Try a different search."
                          : "Type a song name and press Enter to find its lyrics."}
                  </p>
                </div>
              )}
              {error && results.length > 0 && (
                <p className="mt-2 text-xs text-destructive">{error}</p>
              )}
            </div>
          </TabsContent>

          {/* Paste */}
          <TabsContent
            value="paste"
            className="flex-1 min-h-0 overflow-y-auto scroll-thin px-6 pt-4 pb-2 m-0 space-y-3 animate-in fade-in-0 slide-in-from-right-3 duration-200 ease-out"
          >
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Song title (optional)"
              className="h-10"
            />
            <Textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder={"Verse 1\nLine one\nLine two\n\nChorus\nLine one\nLine two"}
              className="min-h-[260px] font-serif text-[15px] leading-7"
            />
            <p className="text-[11px] text-muted-foreground">
              A blank line starts a new slide, or set a fixed lines-per-slide below.
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter className="px-6 py-4 border-t border-border sm:justify-between">
          <Button variant="ghost" size="sm" onClick={startBlank}>
            Start blank instead
          </Button>
          <div className="flex items-center gap-2">
            <label
              htmlFor="lines-per-slide"
              className="text-[12px] text-muted-foreground whitespace-nowrap"
              title="Leave blank to break on blank lines; set a number to break every N lines"
            >
              Lines / slide
            </label>
            <Input
              id="lines-per-slide"
              type="text"
              inputMode="numeric"
              value={linesPerSlide}
              onChange={(e) => setLinesPerSlide(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && lyrics.trim()) {
                  e.preventDefault()
                  create()
                }
              }}
              placeholder="Auto"
              className="h-8 w-16 text-center"
            />
            <Button size="sm" onClick={create} disabled={!lyrics.trim()}>
              Create song
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
