"use client"

import { useEffect } from "react"
import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Highlight from "@tiptap/extension-highlight"
import { Markdown } from "tiptap-markdown"
import { Check } from "lucide-react"
import { NotesList } from "./notes-list"
import { NotesToolbar, type NotesEditorFormat } from "./notes-toolbar"
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
    selector: ({ editor }): NotesEditorFormat => ({
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
  const activeNote = savedNotes.find((n) => n.id === activeNoteId)
  const dirty = activeNote
    ? activeNote.title !== title || activeNote.body !== text
    : !isEmpty
  const saveStatus = isEmpty ? "" : dirty ? "Saving…" : "Saved"

  return (
    <div className="h-full flex">
      <NotesList
        notes={savedNotes}
        activeNoteId={activeNoteId}
        onSelectNote={onSelectNote}
        onNewNote={onNewNote}
        onDeleteNote={onDeleteNote}
      />

      <div className="flex-1 min-w-0 flex flex-col h-full min-h-0">
        <div className="h-14 shrink-0 px-6 border-b border-border flex items-center justify-end">
          {saveStatus && (
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {saveStatus === "Saved" && <Check className="size-3" />}
              {saveStatus}
            </span>
          )}
        </div>

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

        <NotesToolbar
          editor={editor}
          format={fmt}
          isEmpty={isEmpty}
          onPreview={onPreview}
          onProject={onProject}
          onAddToQueue={onAddToQueue}
        />
      </div>
    </div>
  )
}
