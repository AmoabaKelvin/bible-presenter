"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Eye,
  Plus,
  Radio,
} from "lucide-react"

interface NotesPaneProps {
  title: string
  text: string
  onTitleChange: (v: string) => void
  onTextChange: (v: string) => void
  onPreview: () => void
  onProject: () => void
  onAddToQueue: () => void
}

export function NotesPane({
  title,
  text,
  onTitleChange,
  onTextChange,
  onPreview,
  onProject,
  onAddToQueue,
}: NotesPaneProps) {
  const taRef = useRef<HTMLTextAreaElement>(null)

  const wrap = (prefix: string, suffix = prefix) => {
    const ta = taRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const before = text.substring(0, start)
    const sel = text.substring(start, end)
    const after = text.substring(end)
    const next = `${before}${prefix}${sel}${suffix}${after}`
    onTextChange(next)
    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(start + prefix.length, end + prefix.length)
    }, 0)
  }

  const isEmpty = !title.trim() && !text.trim()

  return (
    <div className="h-full flex flex-col mx-auto w-full max-w-[960px] px-10 pt-8 pb-6">
      <header className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-medium">Compose note</h2>
        <span className="eyebrow">Markdown supported</span>
      </header>

      <label className="block">
        <span className="eyebrow block mb-1.5">Title</span>
        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="e.g. Sermon point 1"
          className="h-9"
        />
      </label>

      <div className="mt-4 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="eyebrow">Body</span>
          <div className="flex items-center gap-0.5">
            <ToolBtn label="Bold" onClick={() => wrap("**")}>
              <Bold className="size-3.5" />
            </ToolBtn>
            <ToolBtn label="Italic" onClick={() => wrap("*")}>
              <Italic className="size-3.5" />
            </ToolBtn>
            <ToolBtn label="Underline" onClick={() => wrap("<u>", "</u>")}>
              <Underline className="size-3.5" />
            </ToolBtn>
            <Separator orientation="vertical" className="!h-4 mx-1" />
            <ToolBtn label="Bullet list" onClick={() => wrap("- ", "")}>
              <List className="size-3.5" />
            </ToolBtn>
            <ToolBtn label="Numbered list" onClick={() => wrap("1. ", "")}>
              <ListOrdered className="size-3.5" />
            </ToolBtn>
          </div>
        </div>
        <Textarea
          ref={taRef}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Type the cue text the audience will read…"
          className="flex-1 resize-none min-h-[200px] font-serif text-base leading-relaxed"
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Button variant="outline" onClick={onPreview} disabled={isEmpty}>
          <Eye className="size-4 mr-2" />
          Preview
        </Button>
        <Button variant="outline" onClick={onAddToQueue} disabled={isEmpty}>
          <Plus className="size-4 mr-2" />
          Queue
        </Button>
        <Button onClick={onProject} disabled={isEmpty}>
          <Radio className="size-4 mr-2" />
          Go live
        </Button>
      </div>
    </div>
  )
}

function ToolBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="size-7 grid place-items-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
    >
      {children}
    </button>
  )
}
