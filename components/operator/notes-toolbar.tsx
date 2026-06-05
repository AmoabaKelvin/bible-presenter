"use client"

import { type Editor, useEditorState } from "@tiptap/react"
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
} from "lucide-react"

// Compact formatting bar bound to a single slide-card editor. Each card owns
// its own editor, so the bar reads its active state directly from that editor.
export function NoteFormatBar({ editor }: { editor: Editor | null }) {
  const fmt = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive("bold") ?? false,
      italic: editor?.isActive("italic") ?? false,
      underline: editor?.isActive("underline") ?? false,
      highlight: editor?.isActive("highlight") ?? false,
      heading: editor?.isActive("heading", { level: 2 }) ?? false,
      bullet: editor?.isActive("bulletList") ?? false,
      ordered: editor?.isActive("orderedList") ?? false,
      blockquote: editor?.isActive("blockquote") ?? false,
    }),
  })

  return (
    <div className="flex items-center gap-0.5">
      <ToolBtn label="Bold" active={fmt?.bold} onClick={() => editor?.chain().focus().toggleBold().run()}>
        <Bold className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Italic" active={fmt?.italic} onClick={() => editor?.chain().focus().toggleItalic().run()}>
        <Italic className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Underline" active={fmt?.underline} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
        <Underline className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Highlight" active={fmt?.highlight} onClick={() => editor?.chain().focus().toggleHighlight().run()}>
        <Highlighter className="size-3.5" />
      </ToolBtn>
      <span className="w-px h-4 bg-border mx-1" />
      <ToolBtn label="Heading" active={fmt?.heading} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Bullet list" active={fmt?.bullet} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
        <List className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Numbered list" active={fmt?.ordered} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Quote" active={fmt?.blockquote} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
        <Quote className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Clear formatting" onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}>
        <RemoveFormatting className="size-3.5" />
      </ToolBtn>
    </div>
  )
}

function ToolBtn({
  children,
  label,
  active,
  onClick,
}: {
  children: React.ReactNode
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`size-7 grid place-items-center rounded-sm transition-colors ${
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  )
}
