import type { Metadata } from "next"
import Link from "next/link"
import "../legal.css"

export const metadata: Metadata = {
  title: "Privacy Policy | flowwww",
  description: "Privacy Policy for flowwww.",
}

export default function PrivacyPage() {
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

        <h1 className="legal-title">Privacy Policy</h1>
        <p className="legal-updated">Last updated: May 28, 2026</p>

        <section className="legal-content">
          <p>
            flowwww is a personal presentation tool for displaying scripture, notes, media, and
            music during worship or presentation workflows. This policy explains what information
            the app accesses and how it is used.
          </p>

          <h2>Information We Access</h2>
          <p>When you connect a third-party account, flowwww may access limited account data:</p>
          <ul>
            <li>
              Google/YouTube: YouTube channel profile information, YouTube playlists, and playlist
              items through the YouTube Data API read-only scope.
            </li>
            <li>
              Spotify: Spotify profile information, playlists, playback state, and playback control
              permissions needed to play music in the app.
            </li>
          </ul>

          <h2>How We Use Information</h2>
          <p>
            Account data is used only to show your connected account, list your playlists, select
            tracks or videos, and control playback in the slideshow/output window. flowwww does not
            sell account data or use it for advertising.
          </p>

          <h2>OAuth Tokens</h2>
          <p>
            OAuth access and refresh tokens are stored in encrypted, HTTP-only cookies so the app
            can maintain your connection and refresh access when needed. Tokens are used only to
            call the relevant Google/YouTube or Spotify APIs for the features you request.
          </p>

          <h2>Local App Data</h2>
          <p>
            Some presentation state, such as selected scripture, queue items, background settings,
            media references, and music state, is stored in your browser&apos;s local storage. This
            keeps the operator and output windows in sync on your own device.
          </p>

          <h2>Data Sharing</h2>
          <p>
            flowwww does not share your personal data with advertisers or data brokers. Data is sent
            to Google/YouTube and Spotify only as needed to authenticate your account, retrieve
            playlist information, and control playback.
          </p>

          <h2>Google API Services User Data Policy</h2>
          <p>
            flowwww&apos;s use and transfer of information received from Google APIs adheres to the{" "}
            <a href="https://developers.google.com/terms/api-services-user-data-policy">
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>

          <h2>Deleting or Revoking Access</h2>
          <p>
            You can disconnect YouTube or Spotify inside the app. You can also revoke access from
            your Google Account permissions page or Spotify account settings. Revoking access
            prevents flowwww from making further API requests for that account.
          </p>

          <h2>Contact</h2>
          <p>
            For privacy questions, contact the app owner at{" "}
            <a href="mailto:kel.amoaba@gmail.com">kel.amoaba@gmail.com</a>.
          </p>
        </section>

        <div className="legal-footer-links">
          <Link href="/">Back to app</Link>
          <Link href="/terms">Terms of Use</Link>
        </div>
      </div>
    </main>
  )
}
