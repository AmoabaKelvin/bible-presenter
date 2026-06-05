"use client"

import { useEffect, useRef } from "react"
import { useEditor, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Highlight from "@tiptap/extension-highlight"
import { Markdown } from "tiptap-markdown"
import { ChevronUp, ChevronDown, Trash2, Eye, Plus, Radio } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { NoteFormatBar } from "./notes-toolbar"
import type { NoteSlide } from "./types"

function getMarkdown(editor: Editor): string {
  return (
    editor.storage as unknown as { markdown: { getMarkdown: () => string } }
  ).markdown.getMarkdown()
}

interface NoteSlideCardProps {
  slide: NoteSlide
  index: number
  total: number
  isNew: boolean
  isActive: boolean
  onActivate: () => void
  onChange: (patch: Partial<Pick<NoteSlide, "title" | "body">>) => void
  onPreview: () => void
  onProject: () => void
  onQueue: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

export function NoteSlideCard({
  slide,
  index,
  total,
  isNew,
  isActive,
  onActivate,
  onChange,
  onPreview,
  onProject,
  onQueue,
  onDelete,
  onMoveUp,
  onMoveDown,
}: NoteSlideCardProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Slide text…" }),
      Highlight,
      Markdown.configure({ html: true, transformPastedText: true }),
    ],
    content: slide.body,
    editorProps: {
      attributes: {
        class:
          "tiptap prose prose-neutral dark:prose-invert max-w-none focus:outline-none min-h-[120px] text-[17px] leading-8",
      },
    },
    onUpdate: ({ editor }) => onChange({ body: getMarkdown(editor) }),
  })

  // Reflect external content changes (selecting another note) into the editor
  // without echoing our own edits back in.
  useEffect(() => {
    if (!editor) return
    if (slide.body !== getMarkdown(editor)) {
      editor.commands.setContent(slide.body, { emitUpdate: false })
    }
  }, [slide.body, editor])

  // A freshly added slide scrolls into view and takes focus, once.
  const cardRef = useRef<HTMLDivElement>(null)
  const enteredRef = useRef(false)
  useEffect(() => {
    if (!isNew || enteredRef.current || !editor) return
    enteredRef.current = true
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    editor.commands.focus("end")
  }, [isNew, editor])

  return (
    <div
      ref={cardRef}
      onFocusCapture={onActivate}
      className={`rounded-lg border bg-card/40 overflow-hidden transition-colors ${
        isActive ? "border-foreground/25" : "border-border"
      } ${isNew ? "animate-in fade-in-0 slide-in-from-top-2 duration-300 ease-out" : ""}`}
    >
      <div className="flex items-center justify-between gap-2 px-3 h-10 border-b border-border bg-muted/30">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
            Slide {index + 1}
          </span>
          <IconBtn label="Move up" disabled={index === 0} onClick={onMoveUp}>
            <ChevronUp className="size-3.5" />
          </IconBtn>
          <IconBtn label="Move down" disabled={index === total - 1} onClick={onMoveDown}>
            <ChevronDown className="size-3.5" />
          </IconBtn>
        </div>
        <div className="flex items-center gap-1">
          <IconBtn label="Preview" onClick={onPreview}>
            <Eye className="size-3.5" />
          </IconBtn>
          <IconBtn label="Add to queue" onClick={onQueue}>
            <Plus className="size-3.5" />
          </IconBtn>
          <IconBtn label="Go live" onClick={onProject}>
            <Radio className="size-3.5" />
          </IconBtn>
          <span className="w-px h-4 bg-border mx-0.5" />
          <IconBtn label="Delete slide" onClick={onDelete}>
            <Trash2 className="size-3.5 hover:text-destructive" />
          </IconBtn>
        </div>
      </div>

      <div className="px-4 py-3">
        <input
          value={slide.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Title — optional"
          className="w-full bg-transparent border-0 outline-none text-[15px] font-semibold tracking-tight placeholder:text-muted-foreground/35 mb-1.5"
        />
        <EditorContent editor={editor} />
      </div>

      {isActive && (
        <div className="px-3 py-1.5 border-t border-border bg-muted/20 animate-in fade-in-0 duration-150">
          <NoteFormatBar editor={editor} />
        </div>
      )}
    </div>
  )
}

function IconBtn({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  label: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className="size-7 grid place-items-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}
