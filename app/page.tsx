"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { FontSize } from "@/components/slide-stage"
import { LeftRail } from "@/components/operator/left-rail"
import { CommandPalette } from "@/components/operator/command-palette"
import { ShowsLibrary } from "@/components/operator/shows-library"
import { BiblePane } from "@/components/operator/bible-pane"
import { NotesPane } from "@/components/operator/notes-pane"
import { SongsPane } from "@/components/operator/songs-pane"
import { MediaPane } from "@/components/operator/media-pane"
import { DictionaryPane } from "@/components/operator/dictionary-pane"
import { RightRail } from "@/components/operator/right-rail"
import type { Mode } from "@/components/operator/types"
import { useOperatorBible } from "@/hooks/use-operator-bible"
import { useOperatorKeyboardShortcuts } from "@/hooks/use-operator-keyboard-shortcuts"
import { useOperatorMedia } from "@/hooks/use-operator-media"
import { useOperatorMusic } from "@/hooks/use-operator-music"
import { useOperatorNotes } from "@/hooks/use-operator-notes"
import { useOperatorSongs } from "@/hooks/use-operator-songs"
import { useOperatorProjection } from "@/hooks/use-operator-projection"
import { useOperatorSlideActions } from "@/hooks/use-operator-slide-actions"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { useGoogleFont } from "@/hooks/use-google-font"
import { useWarmSemanticIndex } from "@/hooks/use-warm-semantic-index"
import { useWarmBundledBibles } from "@/hooks/use-warm-bundled-bibles"
import { DEFAULT_PRESENTATION, mergePresentation, type PresentationSettings } from "@/lib/presentation-settings"
import type { ShowSnapshot } from "@/components/operator/types"

const VERSION_KEY = "bibleVersion"

export default function OperatorPage() {
  const [mode, setMode] = usePersistedState<Mode>("workspace:mode", "bible")
  const [fontSize, setFontSize] = usePersistedState<FontSize>("workspace:fontSize", "extra-large")
  const [version, setVersion] = usePersistedState(VERSION_KEY, "KJV")
  const [storedPresentation, setPresentation] = usePersistedState<PresentationSettings>(
    "presentation",
    DEFAULT_PRESENTATION,
  )
  // Settings persisted before newer fields (referenceFontFamily, referencePosition,
  // fontScale) existed lack them; merge defaults so every consumer sees a complete
  // object and never reads an undefined field.
  const presentation = useMemo(() => mergePresentation(storedPresentation), [storedPresentation])
  useGoogleFont(presentation.fontFamily)
  useGoogleFont(presentation.referenceFontFamily)
  useWarmBundledBibles(version)
  useWarmSemanticIndex()
  const [showsOpen, setShowsOpen] = useState(false)
  const [bibleSearchQuery, setBibleSearchQuery] = useState("")

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
    restoreQueue,
    applyHighlight,
    clearHighlights,
  } = useOperatorProjection({ fontSize, version, previewContentRef })
  const {
    media,
    folders: mediaFolders,
    background,
    themeLoaded,
    handleMediaUpload,
    addVideos,
    deleteMedia,
    handlePreviewMedia,
    handleProjectMedia,
    prepareMedia,
    setMediaAsBackground,
    createMediaFolder,
    renameMediaFolder,
    deleteMediaFolder,
    moveMediaToFolder,
    moveManyToFolder,
    uploadMediaFolder,
  } = useOperatorMedia({
    setPreviewVerses,
    setLiveVerses,
    setPreviewMedia,
    setLiveMedia,
    writeToOutput,
  })
  const {
    note: activeNote,
    savedNotes,
    activeNoteId,
    newSlideId,
    folders: noteFolders,
    setDeckTitle,
    updateSlide,
    addSlide,
    deleteSlide,
    moveSlide,
    selectNote,
    newNote,
    deleteNote,
    createFolder: createNoteFolder,
    renameFolder: renameNoteFolder,
    deleteFolder: deleteNoteFolder,
    moveNoteToFolder,
  } = useOperatorNotes()
  const {
    song: activeSong,
    songs,
    activeSongId,
    newSlideId: newSongSlideId,
    setTitle: setSongTitle,
    updateSlide: updateSongSlide,
    addSlide: addSongSlide,
    deleteSlide: deleteSongSlide,
    moveSlide: moveSongSlide,
    createBlankSong,
    createFromPaste,
    selectSong,
    removeSong,
  } = useOperatorSongs()
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
    goToReference,
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
    defineSelection,
    previewSlide,
    projectSlide,
    previewDefinition,
    projectDefinition,
    queueDefinition,
  } = useOperatorSlideActions({
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

  // ── Shows: capture / restore a full operator snapshot ──────────────────
  const captureSnapshot = useCallback(
    (): ShowSnapshot => ({
      queue,
      queueCursor,
      liveVerses,
      version,
      presentation,
      background: background.config,
    }),
    [queue, queueCursor, liveVerses, version, presentation, background.config],
  )

  const restoreSnapshot = useCallback(
    (snapshot: ShowSnapshot) => {
      setVersion(snapshot.version)
      setPresentation(snapshot.presentation)
      background.replaceConfig(snapshot.background)
      restoreQueue(snapshot.queue, snapshot.queueCursor)
      setLiveVerses(snapshot.liveVerses)
      writeToOutput(
        snapshot.liveVerses.length > 0 ? { verses: snapshot.liveVerses } : {},
      )
    },
    [
      setVersion,
      setPresentation,
      background,
      restoreQueue,
      setLiveVerses,
      writeToOutput,
    ],
  )

  // Resolve each panel's background by its first slide's kind (default when
  // empty or showing media). The popover/settings preview operate on default.
  const previewBackground = background.resolveTarget(previewVerses[0]?.kind)
  const liveBackground = background.resolveTarget(liveVerses[0]?.kind)
  const defaultBackground = background.resolveTarget(undefined)

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
        onQueueTapReference={(reference) => {
          setMode("bible")
          handleReferenceChange(null, null)
          setBibleSearchQuery(reference)
        }}
        onQueueRemove={queueRemove}
        onQueueReorder={queueReorder}
        onQueuePrev={queuePrev}
        onQueueNext={queueNext}
        onClearQueue={clearQueue}
        onOpenShows={() => setShowsOpen(true)}
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
            searchQuery={bibleSearchQuery}
            onSearchQueryChange={setBibleSearchQuery}
          />
        )}
        {mode === "notes" && (
          <NotesPane
            note={activeNote}
            savedNotes={savedNotes}
            activeNoteId={activeNoteId}
            newSlideId={newSlideId}
            folders={noteFolders}
            liveVerses={liveVerses}
            onDeckTitleChange={setDeckTitle}
            onSlideChange={updateSlide}
            onAddSlide={addSlide}
            onDeleteSlide={deleteSlide}
            onMoveSlide={moveSlide}
            onSelectNote={selectNote}
            onNewNote={newNote}
            onDeleteNote={deleteNote}
            onCreateFolder={createNoteFolder}
            onRenameFolder={renameNoteFolder}
            onDeleteFolder={deleteNoteFolder}
            onMoveNoteToFolder={moveNoteToFolder}
            previewSlide={previewSlide}
            projectSlide={projectSlide}
            addToQueue={addToQueue}
          />
        )}
        {mode === "songs" && (
          <SongsPane
            song={activeSong}
            songs={songs}
            activeSongId={activeSongId}
            newSlideId={newSongSlideId}
            liveVerses={liveVerses}
            onTitleChange={setSongTitle}
            onSlideChange={updateSongSlide}
            onAddSlide={addSongSlide}
            onDeleteSlide={deleteSongSlide}
            onMoveSlide={moveSongSlide}
            onSelectSong={selectSong}
            onNewSong={createBlankSong}
            onCreateFromPaste={createFromPaste}
            onDeleteSong={removeSong}
            previewSlide={previewSlide}
            projectSlide={projectSlide}
            addToQueue={addToQueue}
          />
        )}
        {mode === "media" && (
          <MediaPane
            items={media}
            folders={mediaFolders}
            onUpload={handleMediaUpload}
            onAddVideos={addVideos}
            onUploadFolder={uploadMediaFolder}
            onDelete={deleteMedia}
            onPreview={handlePreviewMedia}
            onProject={handleProjectMedia}
            onPrepare={prepareMedia}
            onSetBackground={setMediaAsBackground}
            onCreateFolder={createMediaFolder}
            onRenameFolder={renameMediaFolder}
            onDeleteFolder={deleteMediaFolder}
            onMoveToFolder={moveMediaToFolder}
            onMoveManyToFolder={moveManyToFolder}
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
        previewMediaKind={previewMedia?.kind ?? "image"}
        liveMediaKind={liveMedia?.kind ?? "image"}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        presentation={presentation}
        onPresentationChange={setPresentation}
        version={version}
        previewBackground={previewBackground}
        liveBackground={liveBackground}
        defaultBackground={defaultBackground}
        backgroundTargets={background.resolvedTargets}
        onLayerColorChange={background.setLayerColor}
        onUploadLayerImage={background.uploadLayerImage}
        onClearLayerImage={background.clearLayerImage}
        onResetLayer={background.resetLayer}
        onResetAllBackgrounds={background.resetAllBackgrounds}
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
        onNavigate={(result) => {
          setMode("bible")
          goToReference(result.reference)
        }}
        onDefinePreview={previewDefinition}
        onDefineProject={projectDefinition}
        onDefineQueue={queueDefinition}
      />

      <ShowsLibrary
        open={showsOpen}
        onOpenChange={setShowsOpen}
        captureSnapshot={captureSnapshot}
        restoreSnapshot={restoreSnapshot}
      />
    </div>
  )
}
