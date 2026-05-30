"use client"

import { useEffect, useMemo } from "react"
import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Highlight from "@tiptap/extension-highlight"
import { Markdown } from "tiptap-markdown"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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
  Trash2,
  PencilLine,
  Check,
} from "lucide-react"
import type { SavedNote } from "./types"

interface NotesPaneProps {
  title: string
  text: string
  savedNotes: SavedNote[]
  activeNoteId: string | null
  onTitleChange: (v: string) => void
  onTextChange: (v: string) => void
  onSelectNote: (note: SavedNote) => void
  onNewNote: () => void
  onDeleteNote: (id: string) => void
  onPreview: () => void
  onProject: () => void
  onAddToQueue: () => void
}

// tiptap-markdown stores its serializer on editor.storage.markdown but doesn't
// augment Tiptap's Storage type, so reach it through a narrow cast.
function getMarkdown(editor: Editor): string {
  return (
    editor.storage as unknown as { markdown: { getMarkdown: () => string } }
  ).markdown.getMarkdown()
}

function relativeTime(ts: number) {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60_000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function stripMd(s: string) {
  return s.replace(/[*_#>`~-]/g, "").replace(/<[^>]+>/g, "").trim()
}

export function NotesPane({
  title,
  text,
  savedNotes,
  activeNoteId,
  onTitleChange,
  onTextChange,
  onSelectNote,
  onNewNote,
  onDeleteNote,
  onPreview,
  onProject,
  onAddToQueue,
}: NotesPaneProps) {
  // WYSIWYG editor that reads and writes Markdown, so stored notes and the
  // slide renderer (react-markdown) stay unchanged. Markdown shortcuts (**, #,
  // - …) still work via StarterKit's input rules for power users.
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Start writing…" }),
      Highlight,
      // html:true lets non-markdown marks (underline, highlight) round-trip as
      // <u>/<mark>, which the slide renderer (rehypeRaw) displays.
      Markdown.configure({ html: true, transformPastedText: true }),
    ],
    content: text,
    editorProps: {
      attributes: {
        class:
          "tiptap prose prose-neutral dark:prose-invert max-w-none focus:outline-none min-h-[320px] text-[19px] leading-9",
      },
    },
    onUpdate: ({ editor }) => onTextChange(getMarkdown(editor)),
  })

  // Reflect external content changes (selecting a saved note, New note) into
  // the editor without feeding our own edits back in.
  useEffect(() => {
    if (!editor) return
    if (text !== getMarkdown(editor)) {
      editor.commands.setContent(text, { emitUpdate: false })
    }
  }, [text, editor])

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
      canUndo: editor?.can().undo() ?? false,
      canRedo: editor?.can().redo() ?? false,
    }),
  })

  const isEmpty = !title.trim() && !text.trim()
  const sortedNotes = useMemo(
    () => [...savedNotes].sort((a, b) => b.updatedAt - a.updatedAt),
    [savedNotes],
  )

  const activeNote = savedNotes.find((n) => n.id === activeNoteId)
  const dirty = activeNote
    ? activeNote.title !== title || activeNote.body !== text
    : !isEmpty
  const saveStatus = isEmpty ? "" : dirty ? "Saving…" : "Saved"

  return (
    <div className="h-full flex">
      {/* ── Saved notes list ── */}
      <aside className="w-[320px] shrink-0 border-r border-border flex flex-col h-full min-h-0 bg-card/20">
        <div className="h-14 shrink-0 px-4 border-b border-border flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-medium">Notes</h2>
            {sortedNotes.length > 0 && (
              <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                {sortedNotes.length}
              </span>
            )}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onNewNote}
                className="size-7 grid place-items-center rounded-md border border-border bg-background hover:bg-accent transition-colors"
                aria-label="New note"
              >
                <Plus className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New note</TooltipContent>
          </Tooltip>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          {sortedNotes.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <div className="size-9 rounded-full bg-accent grid place-items-center mx-auto mb-3">
                <PencilLine className="size-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Start writing and your notes save automatically.
              </p>
            </div>
          ) : (
            <ul className="p-1.5 space-y-px">
              {sortedNotes.map((note) => {
                const active = note.id === activeNoteId
                const preview = stripMd(note.body)
                return (
                  <li key={note.id}>
                    <button
                      onClick={() => onSelectNote(note)}
                      className={`group relative w-full text-left pl-3 pr-2 py-2.5 rounded-lg transition-colors ${
                        active ? "bg-accent" : "hover:bg-accent/50"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full transition-colors ${
                          active ? "bg-foreground" : "bg-transparent"
                        }`}
                      />
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[13px] truncate ${
                            active ? "font-semibold" : "font-medium"
                          }`}
                        >
                          {note.title.trim() || "Untitled note"}
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteNote(note.id)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              e.stopPropagation()
                              onDeleteNote(note.id)
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
                          aria-label="Delete note"
                        >
                          <Trash2 className="size-3.5" />
                        </span>
                      </div>
                      <p className="text-[11.5px] text-muted-foreground line-clamp-1 mt-0.5">
                        {preview || "No additional text"}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 font-mono mt-1">
                        {relativeTime(note.updatedAt)}
                      </p>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </ScrollArea>
      </aside>

      {/* ── Editor ── */}
      <div className="flex-1 min-w-0 flex flex-col h-full min-h-0">
        {/* Status strip */}
        <div className="h-14 shrink-0 px-6 border-b border-border flex items-center justify-end">
          {saveStatus && (
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {saveStatus === "Saved" && <Check className="size-3" />}
              {saveStatus}
            </span>
          )}
        </div>

        {/* Document */}
        <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
          <div className="mx-auto w-full max-w-[720px] px-10 pt-8 pb-6 flex flex-col min-h-full">
            <input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Untitled note"
              className="w-full bg-transparent border-0 outline-none text-[26px] font-semibold tracking-tight placeholder:text-muted-foreground/35 mb-3"
            />
            <EditorContent editor={editor} className="flex-1 min-h-0" />
          </div>
        </div>

        {/* Toolbar + project actions */}
        <div className="shrink-0 border-t border-border px-6 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-0.5">
            <ToolBtn
              label="Bold"
              active={fmt?.bold}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              <Bold className="size-3.5" />
            </ToolBtn>
            <ToolBtn
              label="Italic"
              active={fmt?.italic}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              <Italic className="size-3.5" />
            </ToolBtn>
            <ToolBtn
              label="Underline"
              active={fmt?.underline}
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
            >
              <Underline className="size-3.5" />
            </ToolBtn>
            <ToolBtn
              label="Highlight"
              active={fmt?.highlight}
              onClick={() => editor?.chain().focus().toggleHighlight().run()}
            >
              <Highlighter className="size-3.5" />
            </ToolBtn>
            <span className="w-px h-4 bg-border mx-1" />
            <ToolBtn
              label="Heading"
              active={fmt?.heading}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              <Heading2 className="size-3.5" />
            </ToolBtn>
            <ToolBtn
              label="Bullet list"
              active={fmt?.bullet}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              <List className="size-3.5" />
            </ToolBtn>
            <ToolBtn
              label="Numbered list"
              active={fmt?.ordered}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered className="size-3.5" />
            </ToolBtn>
            <ToolBtn
              label="Quote"
              active={fmt?.blockquote}
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
              disabled={!fmt?.canUndo}
              onClick={() => editor?.chain().focus().undo().run()}
            >
              <Undo2 className="size-3.5" />
            </ToolBtn>
            <ToolBtn
              label="Redo"
              disabled={!fmt?.canRedo}
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
