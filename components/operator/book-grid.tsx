"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { oldTestament, newTestament, type BibleBook } from "@/lib/bible-data"

interface BookGridProps {
  selectedBook: BibleBook | null
  query: string
  onSelect: (book: BibleBook) => void
}

export function BookGrid({ selectedBook, query, onSelect }: BookGridProps) {
  const q = query.trim().toLowerCase()
  const ot = q ? oldTestament.filter((b) => b.name.toLowerCase().includes(q)) : oldTestament
  const nt = q ? newTestament.filter((b) => b.name.toLowerCase().includes(q)) : newTestament
  const empty = ot.length === 0 && nt.length === 0

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="px-8 py-8 max-w-[1100px] mx-auto">
        {empty ? (
          <p className="text-sm text-muted-foreground text-center py-16">
            No books match &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <>
            <Section
              label="Old Testament"
              books={ot}
              selected={selectedBook}
              onSelect={onSelect}
            />
            <Section
              label="New Testament"
              books={nt}
              selected={selectedBook}
              onSelect={onSelect}
              className="mt-10"
            />
          </>
        )}
      </div>
    </ScrollArea>
  )
}

function Section({
  label,
  books,
  selected,
  onSelect,
  className = "",
}: {
  label: string
  books: BibleBook[]
  selected: BibleBook | null
  onSelect: (b: BibleBook) => void
  className?: string
}) {
  if (books.length === 0) return null
  return (
    <section className={className}>
      <div className="flex items-center gap-3 mb-4">
        <span className="eyebrow">{label}</span>
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-mono text-muted-foreground tabular-nums">{books.length}</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1.5">
        {books.map((book) => {
          const active = selected?.name === book.name
          return (
            <button
              key={book.name}
              onClick={() => onSelect(book)}
              className={`group text-left px-3 py-2.5 rounded-md border transition-all ${
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card hover:border-muted-foreground hover:bg-accent"
              }`}
            >
              <div className="text-sm font-medium leading-tight">{book.name}</div>
              <div
                className={`text-[10.5px] font-mono mt-1 tabular-nums ${
                  active ? "text-background/70" : "text-muted-foreground"
                }`}
              >
                {book.chapters.length} ch
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
