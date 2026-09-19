FlowCast desktop build

The desktop target packages the Next.js app and Swift voice helper into one Apple Silicon macOS application. It requires macOS 14 or later. The website still uses the existing development and deployment commands.

On a development Mac with Node 22.12+, Bun, and Xcode command-line tools:

```sh
bun install
bun run desktop:build
bun run desktop:start
```

Build the disk image with `bun run desktop:package`, or run `bun run desktop:dmg` to build everything and package it. The artifact is `dist/FlowCast-<version>-arm64.dmg`. The local build is ad-hoc signed without the hardened runtime, which only release builds enable. It is suitable for local testing; it is not an Apple-notarized public release.

The DMG contains one FlowCast application. Users do not install or start the helper separately. Clicking the microphone starts the bundled helper and downloads its speech and scripture-vocabulary models as needed. Download progress for both models (percentage and file counts) appears in the voice status bar. The first setup needs internet; downloaded models remain under `~/Library/Application Support/FlowCast/speech-models`. If setup fails, turn voice off and on to retry. The helper has a per-launch authentication token, chooses an available loopback port, and exits when FlowCast exits.

Choose Open output in the app, or Presentation > Open output in the macOS menu. With multiple displays, choose the audience display. Output fills that display while the operator remains on the Mac. With one display, output opens as a regular preview window. Use extended desktop in macOS rather than display mirroring. Close output before choosing another display. Disconnecting the active audience display closes output and shows a notice. The F key and fullscreen control use native window fullscreen in the desktop app.

Both windows use the same persistent profile and `http://127.0.0.1:47820`. Do not change that port in an installed release without migrating origin-bound storage. If another process occupies it, FlowCast reports a startup error. Its server only accepts authenticated app requests, apart from OAuth callbacks that validate a single-use state. Existing Chrome or Safari data does not automatically transfer into this profile.

The main process exposes a narrow preload bridge. Renderers keep sandboxing and context isolation enabled, and have no Node access. File access permits reading user-selected file handles, including across the two windows; write access and directory access are denied. Microphone access uses the macOS permission prompt. The helper only receives audio clips and does not own microphone capture.

Account connections require desktop OAuth registrations. Set these environment variables when running `desktop:build`, or put them in a gitignored `.env.desktop`, which the build loads:

| Variable | Registration |
| --- | --- |
| `FLOWCAST_SPOTIFY_CLIENT_ID` | Spotify client ID with `http://127.0.0.1:47820/api/spotify/callback` registered. Uses authorization code with PKCE; no Spotify secret is included. |
| `FLOWCAST_GOOGLE_CLIENT_ID` | Google OAuth client of type Desktop app. Uses the loopback callback `http://127.0.0.1:47820/api/youtube/callback` and PKCE. |
| `FLOWCAST_GOOGLE_CLIENT_SECRET` | The value associated with that Google Desktop app registration, if required by its token endpoint. This is an installed-app credential, distributed with the app; never supply the website's confidential client secret here. |

Login opens the default browser. The local callback verifies state, exchanges the code, and refreshes the operator's connection status without navigating away from the show. Tokens are encrypted with AES-GCM using a per-installation key protected by Electron safeStorage and macOS Keychain. The production website's `.env` files, cookie keys, and OAuth secrets are excluded from the staged bundle. Without desktop client IDs, the application runs and explains the missing configuration when account login is requested.

Spotify's existing embedded Web Playback SDK requires encrypted-media support. Stock Electron must not be assumed to provide the needed DRM. The desktop smoke test does not establish Spotify playback compatibility. Verify playback with a registered client and account before treating music integration as release-ready. YouTube account login also requires its desktop client registration. Public embeds and online services still need internet.

For a public release, install a Developer ID Application signing certificate or provide electron-builder's `CSC_LINK` and `CSC_KEY_PASSWORD`, then set `FLOWCAST_RELEASE=1` when packaging. Supply notarization credentials through `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`, or the supported App Store Connect API-key variables. Release mode requires signing and enables notarization. The helper and application are signed together. Never commit certificates or credentials.

The macOS workflow builds an ad-hoc DMG. Pushing a `desktop-v*` tag (matching the `package.json` version) builds it and publishes it to that tag's GitHub release as a pre-release; a manual run only uploads a build artifact. It reads the `FLOWCAST_SPOTIFY_CLIENT_ID` and `FLOWCAST_GOOGLE_CLIENT_ID` repository variables and the `FLOWCAST_GOOGLE_DESKTOP_CLIENT_SECRET` secret. The notarized option of a manual run requires the signing secrets. It never changes the deployed website.

Checks:

```sh
bun run desktop:test
bun run desktop:smoke
```

The smoke test launches the staged application with an isolated profile under the macOS temporary directory. It exercises the private server, callback rejection, renderer isolation, operator/output storage synchronization, native fullscreen, the real Swift WebSocket listener and token rejection, and persistence across a page reload. It captures operator/output screenshots. It does not request microphone access or download models. `node desktop/voice-check.mjs` transcribes synthesized speech through the staged helper using the app's real vocabulary; it downloads models on first use, or into a scratch directory given with `--models`.

Before public distribution, also test the packaged app from a mounted DMG on a clean Mac account, denied/granted microphone access and a mixer input, first-run and interrupted model downloads, offline transcription after setup, video handles across app restarts, saved data across upgrades, projector unplug/replug, and account login/playback. The bundled server uses Next.js's in-memory incremental cache and does not write into the signed application bundle. The website service worker is disabled for the desktop profile.
