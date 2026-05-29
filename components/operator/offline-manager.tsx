"use client"

// Manage offline Bible translations: download a version into IndexedDB (with a
// live progress bar), delete a cached version, and surface the current
// online/offline status. Downloaded versions power the reader and search when
// the network is gone.

import { useEffect, useRef, useState } from "react"
import { Download, Trash2, Check, Wifi, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BIBLE_VERSIONS } from "@/lib/bible-data"
import {
  downloadTranslation,
  TOTAL_CHAPTERS,
  type DownloadProgress,
} from "@/lib/offline-download"
import { deleteVersion, listDownloadedVersions } from "@/lib/bible-cache"

// A small SVG ring that fills clockwise with download progress. When
// indeterminate (indexing phase) it spins with a fixed partial arc.
function ProgressRing({
  value,
  indeterminate,
}: {
  value: number
  indeterminate?: boolean
}) {
  const size = 24
  const stroke = 2.5
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={indeterminate ? "animate-spin" : undefined}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        className="stroke-muted-foreground/25"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={indeterminate ? circ * 0.7 : circ * (1 - value / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="stroke-emerald-500 transition-[stroke-dashoffset] duration-300"
      />
    </svg>
  )
}

export function OfflineManager() {
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<Record<string, DownloadProgress>>({})
  const [online, setOnline] = useState(true)
  const controllers = useRef<Map<string, AbortController>>(new Map())

  const refresh = async () => {
    const metas = await listDownloadedVersions()
    setDownloaded(new Set(metas.filter((m) => m.complete).map((m) => m.code)))
  }

  useEffect(() => {
    refresh()
    setOnline(navigator.onLine)
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener("online", on)
    window.addEventListener("offline", off)
    return () => {
      window.removeEventListener("online", on)
      window.removeEventListener("offline", off)
    }
  }, [])

  const handleDownload = async (code: string) => {
    const controller = new AbortController()
    controllers.current.set(code, controller)
    setProgress((p) => ({ ...p, [code]: { phase: "fetching", done: 0, total: TOTAL_CHAPTERS } }))
    try {
      await downloadTranslation(code, {
        signal: controller.signal,
        onProgress: (pr) => setProgress((p) => ({ ...p, [code]: pr })),
      })
      await refresh()
    } catch {
      // aborted or network failure — leave version undownloaded
    } finally {
      controllers.current.delete(code)
      setProgress((p) => {
        const next = { ...p }
        delete next[code]
        return next
      })
    }
  }

  const handleDelete = async (code: string) => {
    await deleteVersion(code)
    await refresh()
  }

  return (
    <div className="flex flex-col w-[260px]">
      <div className="flex items-center gap-2 px-1 pb-3 text-xs">
        {online ? (
          <>
            <Wifi className="size-3.5 text-emerald-500" />
            <span className="text-muted-foreground">Online · downloads available</span>
          </>
        ) : (
          <>
            <WifiOff className="size-3.5 text-amber-500" />
            <span className="text-muted-foreground">Offline · using downloaded versions</span>
          </>
        )}
      </div>

      <div className="max-h-[60vh] overflow-y-auto pr-1">
        <ul className="space-y-1">
          {BIBLE_VERSIONS.map((v) => {
            const isDownloaded = downloaded.has(v.code)
            const pr = progress[v.code]
            const busy = pr !== undefined
            const pct = pr ? Math.round((pr.done / pr.total) * 100) : 0
            return (
              <li
                key={v.code}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{v.code}</span>
                    {isDownloaded && <Check className="size-3 text-emerald-500" />}
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">{v.name}</p>
                </div>

                {busy ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] tabular-nums text-muted-foreground">
                    {pr.phase === "indexing" ? "Indexing" : `${pct}%`}
                    <ProgressRing value={pct} indeterminate={pr.phase === "indexing"} />
                  </span>
                ) : isDownloaded ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(v.code)}
                    aria-label={`Delete ${v.code}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => handleDownload(v.code)}
                    disabled={!online}
                    aria-label={`Download ${v.code}`}
                  >
                    <Download className="size-3.5" />
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
