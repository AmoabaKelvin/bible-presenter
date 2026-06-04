"use client"

import { useEffect, useRef } from "react"
import type { FontSize } from "@/components/slide-stage"
import { LeftRail } from "@/components/operator/left-rail"
import { CommandPalette } from "@/components/operator/command-palette"
import { BiblePane } from "@/components/operator/bible-pane"
import { NotesPane } from "@/components/operator/notes-pane"
import { MediaPane } from "@/components/operator/media-pane"
import { DictionaryPane } from "@/components/operator/dictionary-pane"
import { RightRail } from "@/components/operator/right-rail"
import type { Mode } from "@/components/operator/types"
import { useOperatorBible } from "@/hooks/use-operator-bible"
import { useOperatorKeyboardShortcuts } from "@/hooks/use-operator-keyboard-shortcuts"
import { useOperatorMedia } from "@/hooks/use-operator-media"
import { useOperatorMusic } from "@/hooks/use-operator-music"
import { useOperatorNotes } from "@/hooks/use-operator-notes"
import { useOperatorProjection } from "@/hooks/use-operator-projection"
import { useOperatorSlideActions } from "@/hooks/use-operator-slide-actions"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { useGoogleFont } from "@/hooks/use-google-font"
import { DEFAULT_PRESENTATION, type PresentationSettings } from "@/lib/presentation-settings"

const VERSION_KEY = "bibleVersion"

export default function OperatorPage() {
  const [mode, setMode] = usePersistedState<Mode>("workspace:mode", "bible")
  const [fontSize, setFontSize] = usePersistedState<FontSize>("workspace:fontSize", "extra-large")
  const [version, setVersion] = usePersistedState(VERSION_KEY, "KJV")
  const [presentation, setPresentation] = usePersistedState<PresentationSettings>(
    "presentation",
    DEFAULT_PRESENTATION,
  )
  useGoogleFont(presentation.fontFamily)

  const previewContentRef = useRef<HTMLDivElement>(null)
  const {
    previewVerses,
    setPreviewVerses,
    liveVerses,
    setLiveVerses,
    previewMedia,
    setPreviewMedia,
    liveMedia,
    setLiveMedia,
    queue,
    queueCursor,
    history,
    writeToOutput,
    openOutputWindow,
    addToHistory,
    clearHistory,
    projectFromHistory,
    goLive,
    clearLive,
    addToQueue,
    queuePreviewItem,
    queueRemove,
    queueReorder,
    queueGoto,
    queuePreviewAt,
    queuePrev,
    queueNext,
    clearQueue,
    applyHighlight,
    clearHighlights,
  } = useOperatorProjection({ fontSize, version, previewContentRef })
  const {
    media,
    backgroundColor,
    setBackgroundColor,
    backgroundImageUrl,
    backgroundKind,
    themeLoaded,
    handleMediaUpload,
    deleteMedia,
    handlePreviewMedia,
    handleProjectMedia,
    prepareMedia,
    handleBackgroundUpload,
    clearBackgroundImage,
    resetBackground,
  } = useOperatorMedia({
    setPreviewVerses,
    setLiveVerses,
    setPreviewMedia,
    setLiveMedia,
    writeToOutput,
  })
  const {
    noteTitle,
    setNoteTitle,
    noteText,
    setNoteText,
    savedNotes,
    activeNoteId,
    composeNoteVerse,
    selectNote,
    newNote,
    deleteNote,
  } = useOperatorNotes()
  const {
    selectedBook,
    selectedChapter,
    selectedVerse,
    rangeStartVerse,
    rangeEndVerse,
    chapterVerses,
    chapterLoading,
    chapterError,
    handleReferenceChange,
    handleJumpSelect,
    handleJumpProject,
    handleSelectVerse,
    handleDoubleClickVerse,
    stepSelectedVerse,
    goToPreviousChapter,
    goToNextChapter,
    queueVerseFromChapter,
    previewSearchResult,
    projectSearchResult,
    queueSearchResult,
  } = useOperatorBible({
    version,
    setPreviewVerses,
    setLiveVerses,
    setPreviewMedia,
    setLiveMedia,
    writeToOutput,
    addToHistory,
    addToQueue,
  })
  const {
    dictionaryQuery,
    dictionaryQueryNonce,
    previewNote,
    projectNote,
    queueNote,
    defineSelection,
    previewDefinition,
    projectDefinition,
    queueDefinition,
  } = useOperatorSlideActions({
    composeNoteVerse,
    setMode,
    setPreviewVerses,
    setLiveVerses,
    setPreviewMedia,
    setLiveMedia,
    writeToOutput,
    addToHistory,
    addToQueue,
  })

  // ── Document title ─────────────────────────────────────────────────
  useEffect(() => {
    if (liveVerses[0]?.reference) {
      document.title = `${liveVerses[0].reference} · FlowCast`
    } else if (selectedBook && selectedChapter) {
      document.title = `${selectedBook.name} ${selectedChapter} · FlowCast`
    } else {
      document.title = "FlowCast"
    }
  }, [liveVerses, selectedBook, selectedChapter])

  const {
    musicUrl,
    musicState,
    slideshowOnline,
    spotifyStatus,
    setSpotifyStatus,
    youtubeStatus,
    setYouTubeStatus,
    loadYouTubePlaylist: handleMusicLoadYouTubePlaylist,
    loadYouTubeTrack: handleMusicLoadYouTubeTrack,
    loadYouTubeVideo: handleMusicLoadYouTubeVideo,
    loadSpotify: handleMusicLoadSpotify,
    play: handleMusicPlay,
    pause: handleMusicPause,
    next: handleMusicNext,
    prev: handleMusicPrev,
    playAt: handleMusicPlayAt,
    seek: handleMusicSeek,
    volume: handleMusicVolume,
    stop: handleMusicStop,
  } = useOperatorMusic({ openOutputWindow })

  useOperatorKeyboardShortcuts({
    mode,
    selectedVerse,
    selectedBookSelected: !!selectedBook,
    selectedChapterSelected: !!selectedChapter,
    queueLength: queue.length,
    goLive,
    clearLive,
    queuePrev,
    queueNext,
    stepSelectedVerse,
    goToPreviousChapter,
    goToNextChapter,
  })

  return (
    <div className="h-screen flex bg-background text-foreground">
      <LeftRail
        mode={mode}
        onModeChange={setMode}
        recent={history.slice(0, 12)}
        onSelectRecent={projectFromHistory}
        onClearRecent={clearHistory}
        queue={queue}
        queueCursor={queueCursor}
        onQueuePreviewAt={queuePreviewAt}
        onQueueProjectAt={queueGoto}
        onQueueRemove={queueRemove}
        onQueueReorder={queueReorder}
        onQueuePrev={queuePrev}
        onQueueNext={queueNext}
        onClearQueue={clearQueue}
      />

      <main className="flex-1 min-w-0 h-full overflow-hidden">
        {mode === "bible" && (
          <BiblePane
            selectedBook={selectedBook}
            selectedChapter={selectedChapter}
            selectedVerse={selectedVerse}
            rangeStartVerse={rangeStartVerse}
            rangeEndVerse={rangeEndVerse}
            version={version}
            chapterVerses={chapterVerses}
            chapterLoading={chapterLoading}
            chapterError={chapterError}
            onVersionChange={setVersion}
            onReferenceChange={handleReferenceChange}
            onJumpSelect={handleJumpSelect}
            onJumpProject={handleJumpProject}
            onSelectVerse={handleSelectVerse}
            onDoubleClickVerse={handleDoubleClickVerse}
            onQueueVerse={queueVerseFromChapter}
            onPreviewSearchResult={previewSearchResult}
            onProjectSearchResult={projectSearchResult}
            onQueueSearchResult={queueSearchResult}
          />
        )}
        {mode === "notes" && (
          <NotesPane
            title={noteTitle}
            text={noteText}
            savedNotes={savedNotes}
            activeNoteId={activeNoteId}
            onTitleChange={setNoteTitle}
            onTextChange={setNoteText}
            onSelectNote={selectNote}
            onNewNote={newNote}
            onDeleteNote={deleteNote}
            onPreview={previewNote}
            onProject={projectNote}
            onAddToQueue={queueNote}
          />
        )}
        {mode === "media" && (
          <MediaPane
            items={media}
            onUpload={handleMediaUpload}
            onDelete={deleteMedia}
            onPreview={handlePreviewMedia}
            onProject={handleProjectMedia}
            onPrepare={prepareMedia}
          />
        )}
        {mode === "dictionary" && (
          <DictionaryPane
            onPreview={previewDefinition}
            onProject={projectDefinition}
            onQueue={queueDefinition}
            externalQuery={dictionaryQuery}
            externalQueryNonce={dictionaryQueryNonce}
          />
        )}
      </main>

      <RightRail
        previewVerses={previewVerses}
        liveVerses={liveVerses}
        previewMediaUrl={previewMedia?.url ?? null}
        liveMediaUrl={liveMedia?.url ?? null}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        presentation={presentation}
        onPresentationChange={setPresentation}
        version={version}
        backgroundColor={backgroundColor}
        onBackgroundColorChange={setBackgroundColor}
        backgroundImage={backgroundImageUrl}
        backgroundKind={backgroundKind}
        onUploadBackground={handleBackgroundUpload}
        onClearBackground={clearBackgroundImage}
        onResetBackground={resetBackground}
        themeLoaded={themeLoaded}
        previewContentRef={previewContentRef}
        onGoLive={goLive}
        onClearLive={clearLive}
        onOpenOutput={openOutputWindow}
        onApplyHighlight={applyHighlight}
        onClearHighlights={clearHighlights}
        onDefineSelection={defineSelection}
        onAddPreviewToQueue={queuePreviewItem}
        musicState={musicState}
        musicUrl={musicUrl}
        slideshowOnline={slideshowOnline}
        youtubeStatus={youtubeStatus}
        onYouTubeStatusChange={setYouTubeStatus}
        spotifyStatus={spotifyStatus}
        onSpotifyStatusChange={setSpotifyStatus}
        onMusicLoadYouTubePlaylist={handleMusicLoadYouTubePlaylist}
        onMusicLoadYouTubeTrack={handleMusicLoadYouTubeTrack}
        onMusicLoadYouTubeVideo={handleMusicLoadYouTubeVideo}
        onMusicLoadSpotify={handleMusicLoadSpotify}
        onMusicPlay={handleMusicPlay}
        onMusicPause={handleMusicPause}
        onMusicNext={handleMusicNext}
        onMusicPrev={handleMusicPrev}
        onMusicPlayAt={handleMusicPlayAt}
        onMusicSeek={handleMusicSeek}
        onMusicVolume={handleMusicVolume}
        onMusicStop={handleMusicStop}
      />

      <CommandPalette
        version={version}
        onPreview={previewSearchResult}
        onProject={projectSearchResult}
        onQueue={queueSearchResult}
        onDefinePreview={previewDefinition}
        onDefineProject={projectDefinition}
        onDefineQueue={queueDefinition}
      />
    </div>
  )
}
