"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Eye, Pencil, Plus, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"
import { parseSenses, type DictEntry } from "@/lib/dictionary"

const SOURCE_LABEL: Record<DictEntry["source"], string> = {
  eastons: "Easton's Bible Dictionary",
  websters: "Webster's 1913",
}

interface DefinitionCardProps {
  entry: DictEntry
  onPreview: (body: string) => void
  onProject: (body: string) => void
  onQueue: (body: string) => void
}

export function DefinitionCard({
  entry,
  onPreview,
  onProject,
  onQueue,
}: DefinitionCardProps) {
  const senses = useMemo(() => parseSenses(entry.definition), [entry.definition])
  const [selected, setSelected] = useState(0)
  const [draft, setDraft] = useState(senses[0]?.text ?? entry.definition)
  const [editing, setEditing] = useState(false)
  const listRef = useRef<HTMLUListElement>(null)
  const multi = senses.length > 1

  const pick = useCallback(
    (index: number) => {
      setSelected(index)
      setDraft(senses[index]?.text ?? "")
      setEditing(false)
    },
    [senses],
  )

  // Reset to the first sense whenever a new entry is shown.
  useEffect(() => {
    setSelected(0)
    setDraft(senses[0]?.text ?? entry.definition)
    setEditing(false)
  }, [senses, entry.definition])

  const moveSelection = (delta: number) => {
    const next = Math.max(0, Math.min(senses.length - 1, selected + delta))
    if (next === selected) return
    pick(next)
    listRef.current
      ?.querySelector<HTMLLIElement>(`[data-sense-index="${next}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }

  return (
    <div className="rounded-xl border border-border bg-card/40 px-6 py-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-serif text-[26px] capitalize">{entry.word}</h3>
        <span className="shrink-0 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-border text-muted-foreground">
          {SOURCE_LABEL[entry.source]}
        </span>
      </div>

      <ul
        ref={listRef}
        tabIndex={0}
        role="listbox"
        aria-label={`${entry.word} definitions`}
        aria-activedescendant={`sense-${entry.source}-${selected}`}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault()
            moveSelection(1)
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            moveSelection(-1)
          }
        }}
        className="flex flex-col gap-1 outline-none"
      >
        {senses.map((sense, index) => {
          const active = index === selected
          return (
            <li key={index} data-sense-index={index}>
              <div
                className={`relative rounded-lg transition-colors ${
                  active
                    ? "bg-accent/60 ring-1 ring-border/70 shadow-sm"
                    : ""
                }`}
              >
                {/* clickable sense text */}
                <div
                  id={`sense-${entry.source}-${index}`}
                  role="option"
                  aria-selected={active}
                  onClick={() => pick(index)}
                  onDoubleClick={() => onProject(sense.text)}
                  className={`group relative flex gap-3 px-5 py-3 rounded-lg cursor-pointer transition-colors ${
                    active ? "" : "hover:bg-accent/35"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`absolute left-1.5 top-3 bottom-3 w-[3px] rounded-full transition-colors ${
                      active
                        ? "bg-foreground"
                        : "bg-transparent group-hover:bg-foreground/20"
                    }`}
                  />
                  {multi && (
                    <span
                      className={`shrink-0 w-5 text-right font-mono text-[12px] pt-1 tabular-nums transition-colors ${
                        active
                          ? "text-foreground"
                          : "text-muted-foreground/60 group-hover:text-foreground"
                      }`}
                    >
                      {sense.n}.
                    </span>
                  )}
                  <span
                    className={`font-serif text-[15.5px] leading-[1.65] transition-colors ${
                      active ? "text-foreground" : "text-foreground/75"
                    }`}
                  >
                    {sense.text}
                  </span>
                </div>

                {active && (
                  <div className="animate-in fade-in duration-200">
                    {editing && (
                      <div className="px-5 pb-1">
                        <textarea
                          value={draft}
                          autoFocus
                          onChange={(event) => setDraft(event.target.value)}
                          rows={3}
                          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2.5 font-serif text-[15px] leading-[1.6] text-foreground/90 outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                        />
                      </div>
                    )}
                    <div className="mx-5 border-t border-border/60" />
                    <div className="flex items-center gap-1.5 px-4 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setEditing((v) => !v)}
                      >
                        <Pencil className="size-3.5 mr-1.5" />
                        {editing ? "Done" : "Edit text"}
                      </Button>
                      <div className="flex-1" />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={!draft.trim()}
                        onClick={() => onPreview(draft)}
                      >
                        <Eye className="size-3.5 mr-1.5" />
                        Preview
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={!draft.trim()}
                        onClick={() => onQueue(draft)}
                      >
                        <Plus className="size-3.5 mr-1.5" />
                        Queue
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        disabled={!draft.trim()}
                        onClick={() => onProject(draft)}
                      >
                        <Radio className="size-3.5 mr-1.5" />
                        Go live
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
