import type { Metadata } from "next"
import Link from "next/link"
import "../legal.css"

export const metadata: Metadata = {
  title: "Terms of Use | flowwww",
  description: "Terms of Use for flowwww.",
}

export default function TermsPage() {
  return (
    <main className="legal-page">
      <div className="legal-shell">
        <nav className="legal-nav">
          <Link href="/">flowwww</Link>
          <div className="flex items-center gap-4">
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
          </div>
        </nav>

        <h1 className="legal-title">Terms of Use</h1>
        <p className="legal-updated">Last updated: May 28, 2026</p>

        <section className="legal-content">
          <p>
            These Terms of Use govern your use of flowwww, a personal presentation tool for
            scripture, notes, media, and music playback controls.
          </p>

          <h2>Use of the App</h2>
          <p>
            You may use flowwww for personal presentation workflows. You are responsible for how you
            use the app, the content you display, and the music or media you choose to play.
          </p>

          <h2>Connected Services</h2>
          <p>
            flowwww can connect to Google/YouTube and Spotify through OAuth. By connecting an
            account, you authorize the app to use the requested permissions to list playlists,
            access selected media metadata, and control playback where supported.
          </p>

          <h2>Third-Party Terms</h2>
          <p>
            Your use of YouTube and Spotify through flowwww is also subject to those services&apos;
            own terms, policies, and account requirements. You are responsible for complying with
            applicable third-party rules, including rules about playback, public performance, and
            content rights.
          </p>

          <h2>No Content Ownership Transfer</h2>
          <p>
            Connecting a YouTube or Spotify account does not transfer ownership of any content to
            flowwww. Playlist, track, video, album, artist, and account data remain governed by the
            relevant third-party service.
          </p>

          <h2>Availability</h2>
          <p>
            The app depends on browser behavior and third-party APIs. Features may stop working if
            Google/YouTube, Spotify, browser vendors, or hosting providers change their APIs,
            policies, authentication rules, playback behavior, or availability.
          </p>

          <h2>No Warranty</h2>
          <p>
            flowwww is provided as-is without warranties of any kind. The app owner does not
            guarantee uninterrupted access, error-free operation, or compatibility with every
            account, browser, playlist, track, or video.
          </p>

          <h2>Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, the app owner is not liable for indirect,
            incidental, consequential, special, or punitive damages arising from your use of
            flowwww.
          </p>

          <h2>Changes</h2>
          <p>
            These terms may be updated as the app changes. Continued use of flowwww after updates
            means you accept the revised terms.
          </p>

          <h2>Contact</h2>
          <p>
            For questions about these terms, contact{" "}
            <a href="mailto:kelvinamoaba@gmail.com">kelvinamoaba@gmail.com</a>.
          </p>
        </section>

        <div className="legal-footer-links">
          <Link href="/">Back to app</Link>
          <Link href="/privacy">Privacy Policy</Link>
        </div>
      </div>
    </main>
  )
}
