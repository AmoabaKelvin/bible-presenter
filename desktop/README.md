# FlowCast desktop shell — a spike, not shipped

One Mac app instead of two: a [Tauri v2](https://v2.tauri.app) window pointing at
FlowCast, with the `voice-helper` speech app bundled inside it as a sidecar, so
there is a single thing to install.

**It builds and runs.** `FlowCast.app` came out at 28 MB containing both
binaries; launching it started the helper, which bound its port, and the
operator console rendered as a native window. The web app needed no changes —
the shell just points at a URL, so the site stays deployed on Cloudflare.

**It is parked on one blocker: the projector window does not open.** FlowCast
opens its output display with `window.open("/slideshow")`, which the Tauri
webview does not honour, so there is no second screen — the whole point of the
app. Fixing it means creating that window through Tauri (`WebviewWindow`) and
replacing the `localStorage` + `storage`-event transport between the two
windows, since two Tauri webviews are not guaranteed to deliver that event to
each other. Reckon ~30 lines in `hooks/use-slideshow-output.ts` and the
slideshow page, behind a "running inside Tauri" check so the browser keeps
working exactly as it does now.

Also unverified: whether WebGPU exists in this webview (only matters for the
in-browser speech fallback, which the bundled helper makes redundant on a Mac),
and code signing and notarization, which need an Apple Developer account.

## Building it

Needs Rust and `cargo install tauri-cli --version "^2"`.

```sh
cd voice-helper && ./build-app.sh          # the speech helper
cd ../desktop
mkdir -p binaries
cp ../voice-helper/.build/arm64-apple-macosx/release/FlowCastVoice \
   binaries/FlowCastVoice-aarch64-apple-darwin   # the target triple matters
cargo tauri icon ../public/icon-512.png    # the default icon path crashes the build
cargo tauri build --bundles app
```

`tauri.conf.json` points at `http://localhost:3217` for development; change it
to the deployed URL for a real build. An Intel build needs the helper built
`--arch arm64 --arch x86_64` by hand — Tauri only makes universal binaries of
its own Rust.

Pake was considered first and rejected: it wraps Tauri but exposes no sidecar
support, so it cannot bundle the helper and does not achieve the one thing this
is for.
