FlowCast macOS packaging recommendation

Research date: 2026-09-19. This is an implementation plan based on the repository and upstream documentation, not a tested desktop build.

Use Electron with electron-builder to ship one `FlowCast.app` inside an Apple Silicon DMG. Bundle the existing Next.js application and Swift transcription helper together. Target macOS 14 or later. The user confirmed Apple Silicon first and accepted a one-time speech-model download.

| Option | Fit for this repository |
| --- | --- |
| Pake | Convenient for wrapping a website. FlowCast would still need custom helper lifecycle, display selection, persistent storage, and backend integration. That removes much of the benefit of its one-command workflow. |
| Custom Tauri 2 | Viable, with explicit sidecar and window support. Its normal Next.js integration requires static export; preserving this app's server routes requires an additional server/runtime or a backend refactor. macOS WebKit also requires adapting the current video file-picker workflow. |
| Electron + electron-builder | Recommended for the first release. Provides Chromium, a Node runtime, native window/display APIs, and DMG packaging. Its larger runtime is the main tradeoff. |

These are engineering judgments for this app, not claims that Pake or Tauri cannot support presentation software. See [Pake](https://github.com/tw93/Pake), [Tauri's Next.js integration](https://v2.tauri.app/start/frontend/nextjs/), [Tauri sidecars](https://v2.tauri.app/develop/sidecar/), and [Tauri webviews](https://v2.tauri.app/reference/webview-versions/).

The repository already supplies most of the application:

- `app/page.tsx` is the operator interface; `app/slideshow/page.tsx` is the audience output.
- `hooks/use-slideshow-output.ts` opens `/slideshow` using `window.open` and writes slide data to localStorage. `hooks/use-slideshow-projection.ts` reads that storage and listens for changes.
- `hooks/use-media-library.ts` imports videos through `showOpenFilePicker`. `lib/file-handle-store.ts` persists file handles in IndexedDB. This is a concrete reason to prefer Chromium for the first port; the picker is not a portable WebKit assumption. See [Chrome's File System Access documentation](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access).
- `app/api/` contains live routes for fonts, lyrics, Spotify, and YouTube. A static export is not a drop-in replacement.
- `voice-helper/Package.swift` pins FluidAudio 0.15.7 and macOS 14. `voice-helper/build-app.sh` already builds arm64, but packages a separate, ad-hoc-signed helper ZIP.
- `voice-helper/Sources/FlowCastVoice/main.swift` runs a loopback WebSocket server on port 47821. The web app captures microphone audio and sends clips to it. The helper downloads both an ASR model and a vocabulary model through separate calls.

The proposed runtime is:

```text
FlowCast.app
  Electron main process
    Operator window: /
    Audience window: /slideshow, on the selected display
    Bundled Next.js standalone server, loopback only
    Bundled FlowCastVoice executable, managed child process

User data outside the application bundle
  Persistent browser profile: shows, settings, media references
  Downloaded speech models
  Logs and writable runtime caches
```

Build Next.js with a desktop-specific `output: 'standalone'` setting and package its traced dependencies, `public`, and `.next/static`. Those two asset directories are not copied automatically by the standalone build. Run the server in an Electron utility process, using the included Node runtime, and wait for a verified startup signal before loading windows. Test the generated server and native dependencies against the chosen Electron version. See [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) and [Electron utility processes](https://www.electronjs.org/docs/latest/api/utility-process).

Keep the desktop build separate from Cloudflare build initialization. Stage only required build outputs rather than copying the repository or `.env` files. Put writable Next.js caches outside the signed application bundle. Disable the website service worker in desktop builds, including removing any previously registered desktop worker, so an app upgrade cannot serve an older cached UI.

Use one persistent Electron session and a stable loopback origin for both windows. A random HTTP port on every launch changes the origin and makes existing localStorage and IndexedDB appear missing. For the initial implementation, use a reserved fixed app port, enforce a single application instance, and report a port conflict without silently choosing a new origin or loading an unknown listener. Authenticate local service access and verify startup ownership. A stable custom protocol is a possible later design, but proxying all Next.js requests correctly needs separate validation. Existing browser data will not automatically move into Electron's profile; provide export/import if migration is required.

The presentation feature should behave as follows:

1. The operator clicks Open output and chooses a detected display. Prefer an external monitor when available and remember the choice as a preference, validating it on every launch.
2. Electron creates or reuses one independent audience window at `/slideshow`. It uses the selected display's actual bounds rather than the existing hardcoded 1920 by 1080 popup size.
3. Present edge to edge while leaving the operator window usable on the Mac. Evaluate macOS simple fullscreen or a frameless display-sized window first, and test native fullscreen/Spaces behavior on actual hardware.
4. Keep the existing same-origin storage synchronization initially. Write the current slide before opening output, then use a ready handshake for subsequent synchronization rather than relying on a 500 ms startup timer.
5. Handle display connection, removal, resolution changes, and window closure. If the projector disappears, close or hide output and tell the operator rather than moving a fullscreen audience window over the controls. With one display, open a normal preview window.
6. Bridge fullscreen state back to `hooks/use-fullscreen.ts`, because native fullscreen does not imply `document.fullscreenElement`. Preserve the browser implementation for the website. This also keeps the slideshow's cursor/control hiding correct.
7. Prevent display sleep while presenting, release that block when output closes, and validate playback while the operator has focus.

Electron exposes [display enumeration and change events](https://www.electronjs.org/docs/latest/api/screen) and [window/fullscreen controls](https://www.electronjs.org/docs/latest/api/browser-window). This means a separate audience window on a connected projector or display. macOS must use an extended desktop for independent operator and audience views; creating a virtual display is outside this packaging plan.

Bundle the helper executable outside `app.asar`, with any Swift package resources or libraries its release build requires. Add a managed/headless mode so the main app owns startup, status, restart, and shutdown without a second menu-bar app. Keep the standalone mode available for website users. Build and launch the packaged helper by absolute path; users should not need Swift, Xcode, Node, Bun, or Terminal.

For the bundled mode, allow a parent-provided loopback port and per-launch authentication token. This avoids collisions with an independently running website helper. Preserve the current port/protocol for standalone mode. Restrict the accepted origin and terminate only the child this instance owns. Cover parent exit and abnormal termination so a helper cannot remain orphaned.

Expose model download/loading/error/ready status to the operator and retain models in writable per-user storage across updates. Audit FluidAudio's pinned-version cache behavior before choosing its final storage location; do not assume the models are already bundled. Measure actual first-run download size and report it in onboarding. Include the vocabulary model in the first-run/offline test.

`lib/voice-local-engine.ts` currently settles the helper connection after roughly four seconds in the normal case, including time waiting for the ready message. A first model download can exceed that. Separate connection timeout from model initialization and keep a live status subscription, with retry on failure. A bundled helper that is still downloading should not trigger the current "Get the helper" prompt or an accidental in-browser model download.

Microphone capture remains in the operator renderer. Add `NSMicrophoneUsageDescription`, the signing entitlements required for audio input, and permission handlers limited to the app's trusted origin. Test initial grant, denial, recovery, and external audio inputs. See [Electron's media permission API](https://github.com/electron/electron/blob/main/docs/api/system-preferences.md).

Music integration needs explicit desktop work before claiming feature parity. `lib/spotify-auth.ts`, `lib/youtube-auth.ts`, and `lib/oauth-session.ts` currently assume server-held OAuth credentials and encrypted browser cookies. Do not distribute production web client secrets or shared cookie encryption keys in the DMG. Use provider-supported desktop authorization through the system browser, with verified callback/state handling and protected token storage. Spotify documents [authorization code with PKCE](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow); Google documents [desktop authorization](https://developers.google.com/identity/protocols/oauth2/native-app). Existing browser cookies will not automatically authenticate the embedded application. A hosted authentication service is an alternative, but requires an explicit desktop session handoff.

Also test actual Spotify playback early. The existing player uses the [Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk), which relies on encrypted-media support. Chromium rendering alone does not establish that playback will work in the packaged runtime. Verify DRM requirements and distribution support before promising embedded Spotify playback; if necessary, evaluate controlling the installed Spotify app as a separately agreed product change. Validate YouTube embeds, their origin/referrer behavior, and autoplay independently. Online music, uncached fonts, and remote Bible translations remain online features.

Use electron-builder's [resource packaging](https://github.com/electron-userland/electron-builder/blob/master/packages/app-builder-lib/src/options/PlatformSpecificBuildOptions.ts) and [macOS DMG target](https://github.com/electron-userland/electron-builder/blob/master/packages/app-builder-lib/src/options/macOptions.ts). Produce one arm64 application with the helper inside it, then a drag-to-Applications DMG. Sign nested executable code and the outer app with a Developer ID Application certificate, notarize, and staple before public distribution. The existing helper's ad-hoc signature is only suitable for development distribution. See [Electron notarization tooling](https://github.com/electron/notarize). Signing credentials are a release prerequisite, not a prerequisite for building and testing a local prototype.

Implement in this order:

1. Prove packaged Next.js startup, persistent storage, and two-window output on a connected monitor. Check video file handles, external audio capture, and Spotify playback compatibility early.
2. Integrate the managed Swift helper, first-run downloads, progress, error recovery, and offline relaunch.
3. Adapt provider authentication and any media permission behavior that differs from the website.
4. Add the arm64 DMG build and signing/notarization workflow. Validate a downloaded build on a clean Mac account with no development tools installed.

Release acceptance must include first-run and interrupted downloads; offline transcription after both models are installed; imported video playback after relaunch; shows/settings surviving an upgrade; continuous operator control with fullscreen external output; display unplug/replug; denied microphone permissions; helper crash/restart; occupied ports; clean shutdown; and successful opening of the downloaded, notarized app. No desktop build or these runtime tests have been performed as part of this research.
