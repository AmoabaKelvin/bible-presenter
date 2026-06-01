"use client"

import type { Editor } from "@tiptap/react"
import {
  Bold,
  Italic,
  Underline,
  Highlighter,
  Heading2,
  List,
  ListOrdered,
  Quote,
  RemoveFormatting,
  Undo2,
  Redo2,
  Eye,
  Plus,
  Radio,
} from "lucide-react"
import { Button } from "@/components/ui/button"

export type NotesEditorFormat = {
  bold: boolean
  italic: boolean
  underline: boolean
  highlight: boolean
  heading: boolean
  bullet: boolean
  ordered: boolean
  blockquote: boolean
  canUndo: boolean
  canRedo: boolean
}

interface NotesToolbarProps {
  editor: Editor | null
  format: NotesEditorFormat | null | undefined
  isEmpty: boolean
  onPreview: () => void
  onProject: () => void
  onAddToQueue: () => void
}

export function NotesToolbar({
  editor,
  format,
  isEmpty,
  onPreview,
  onProject,
  onAddToQueue,
}: NotesToolbarProps) {
  return (
    <div className="shrink-0 border-t border-border px-6 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-0.5">
        <ToolBtn
          label="Bold"
          active={format?.bold}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="size-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Italic"
          active={format?.italic}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Underline"
          active={format?.underline}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <Underline className="size-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Highlight"
          active={format?.highlight}
          onClick={() => editor?.chain().focus().toggleHighlight().run()}
        >
          <Highlighter className="size-3.5" />
        </ToolBtn>
        <span className="w-px h-4 bg-border mx-1" />
        <ToolBtn
          label="Heading"
          active={format?.heading}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="size-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Bullet list"
          active={format?.bullet}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List className="size-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Numbered list"
          active={format?.ordered}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Quote"
          active={format?.blockquote}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="size-3.5" />
        </ToolBtn>
        <span className="w-px h-4 bg-border mx-1" />
        <ToolBtn
          label="Clear formatting"
          onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}
        >
          <RemoveFormatting className="size-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Undo"
          disabled={!format?.canUndo}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 className="size-3.5" />
        </ToolBtn>
        <ToolBtn
          label="Redo"
          disabled={!format?.canRedo}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 className="size-3.5" />
        </ToolBtn>
      </div>

      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onPreview} disabled={isEmpty}>
          <Eye className="size-3.5 mr-1.5" />
          Preview
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onAddToQueue} disabled={isEmpty}>
          <Plus className="size-3.5 mr-1.5" />
          Queue
        </Button>
        <Button size="sm" className="h-8 text-xs" onClick={onProject} disabled={isEmpty}>
          <Radio className="size-3.5 mr-1.5" />
          Go live
        </Button>
      </div>
    </div>
  )
}

function ToolBtn({
  children,
  label,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`size-7 grid place-items-center rounded-sm transition-colors disabled:opacity-30 disabled:pointer-events-none ${
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  )
}
