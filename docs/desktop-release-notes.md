FlowCast as a single Mac app: the presenter, the audience output window, and voice recognition in one download. Apple Silicon, macOS 14 or later.

**Install**

1. Download the `.dmg` below, open it, drag FlowCast to Applications.
2. This preview isn't notarized by Apple yet, so macOS blocks the first launch. Open it once, then go to System Settings → Privacy & Security → **Open Anyway**. Or run `xattr -dr com.apple.quarantine /Applications/FlowCast.app`.
3. macOS asks for Keychain access on first launch (that's where account logins are protected) and for the microphone when you turn voice on.

The first time you turn on the microphone it downloads the speech models (needs internet once; progress shows in the voice bar). After that voice works offline.

**What's in it**

- Open output picks the display for the audience view and fills it; the operator window stays on your Mac.
- Say a reference ("John three sixteen") or quote a verse, even a few words of one ("he gave gifts unto men"), and it goes to preview or straight to live.
- YouTube and Spotify login open in your browser. Spotify playback inside the app is untested.
- Media: add videos and upload whole folders (both were failing in 0.1.1 and earlier).
- Media: Remove acts on everything you have selected, deleting a folder deletes what is in it (after asking), and the sort order stays put when you switch tabs.
- FlowCast now updates itself: a new release downloads in the background and is installed when you quit, or use FlowCast → Check for Updates…. This is the last version you install by hand. Until the app is notarized, macOS asks again for Keychain and microphone access after each update.
- Songs: bring in a whole EasyWorship 6 or 7 song library. Add a song → EasyWorship, then pick `Songs.db` and `SongWords.db` from EasyWorship's `Databases\Data` folder. Songs already in your library are skipped.
