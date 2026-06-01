import {
  clearOAuthSession,
  consumeOAuthLoginState,
  consumeOAuthReturnTo,
  getFreshOAuthSession,
  makeOAuthState,
  oauthFetch,
  oauthFetchJson,
  readOAuthSession,
  setOAuthLoginCookies,
  toPublicOAuthSession,
  toPublicOAuthStatusSession,
  writeOAuthSession,
  type OAuthSession,
  type PublicOAuthSession,
  type PublicOAuthStatusSession,
} from "@/lib/oauth-session"

const GOOGLE_ACCOUNTS_BASE = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
export const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"

const TOKEN_COOKIE = "flowcastYouTubeSession"
const STATE_COOKIE = "flowcastYouTubeState"
const RETURN_COOKIE = "flowcastYouTubeReturnTo"
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
const STATE_MAX_AGE_SECONDS = 60 * 10

const YOUTUBE_SESSION_CONFIG = {
  tokenCookie: TOKEN_COOKIE,
  stateCookie: STATE_COOKIE,
  returnCookie: RETURN_COOKIE,
  cookieMaxAgeSeconds: COOKIE_MAX_AGE_SECONDS,
  stateMaxAgeSeconds: STATE_MAX_AGE_SECONDS,
  secretCandidates: () => [
    process.env.GOOGLE_COOKIE_SECRET,
    process.env.YOUTUBE_COOKIE_SECRET,
    process.env.SPOTIFY_COOKIE_SECRET,
    process.env.NEXTAUTH_SECRET,
    process.env.AUTH_SECRET,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.YOUTUBE_CLIENT_SECRET,
  ],
  missingSecretMessage: "Missing YouTube cookie secret. Set GOOGLE_COOKIE_SECRET.",
  invalidCookieMessage: "Invalid YouTube session cookie.",
}

export const YOUTUBE_AUTH_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
]

interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  scope?: string
  token_type: string
  refresh_token?: string
}

export type YouTubeSession = OAuthSession

export type PublicYouTubeSession = PublicOAuthSession

export type PublicYouTubeStatusSession = PublicOAuthStatusSession

export function getYouTubeClientConfig(requestUrl?: URL) {
  const { clientId, clientSecret } = getYouTubeCredentials()
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    process.env.YOUTUBE_REDIRECT_URI ||
    (requestUrl ? `${requestUrl.origin}/api/youtube/callback` : undefined)

  if (!redirectUri) {
    throw new Error("Missing YouTube redirect URI. Set GOOGLE_REDIRECT_URI.")
  }

  return { clientId, clientSecret, redirectUri }
}

function getYouTubeCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error("Missing Google OAuth config. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.")
  }

  return { clientId, clientSecret }
}

export function buildYouTubeAuthorizeUrl(requestUrl: URL, state: string) {
  const { clientId, redirectUri } = getYouTubeClientConfig(requestUrl)
  const url = new URL(GOOGLE_ACCOUNTS_BASE)
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("scope", YOUTUBE_AUTH_SCOPES.join(" "))
  url.searchParams.set("state", state)
  url.searchParams.set("access_type", "offline")
  url.searchParams.set("prompt", "consent")
  url.searchParams.set("include_granted_scopes", "true")
  return url
}

export function makeYouTubeState() {
  return makeOAuthState()
}

export async function setYouTubeLoginCookies(state: string, returnTo: string) {
  await setOAuthLoginCookies(YOUTUBE_SESSION_CONFIG, state, returnTo)
}

export async function consumeYouTubeLoginState(receivedState: string | null) {
  return consumeOAuthLoginState(YOUTUBE_SESSION_CONFIG, receivedState)
}

export async function consumeYouTubeReturnTo() {
  return consumeOAuthReturnTo(YOUTUBE_SESSION_CONFIG)
}

export async function exchangeYouTubeCode(code: string, requestUrl: URL) {
  const { clientId, clientSecret, redirectUri } = getYouTubeClientConfig(requestUrl)
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  })
  const data = await requestGoogleToken(body)
  if (!data.refresh_token) throw new Error("Google did not return a refresh token.")
  return toSession(data, data.refresh_token)
}

export async function refreshYouTubeSession(session: YouTubeSession) {
  const { clientId, clientSecret } = getYouTubeCredentials()
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: session.refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  })
  const data = await requestGoogleToken(body)
  return toSession(data, data.refresh_token || session.refreshToken)
}

export async function readYouTubeSession() {
  return readOAuthSession<YouTubeSession>(YOUTUBE_SESSION_CONFIG)
}

export async function getFreshYouTubeSession() {
  return getFreshOAuthSession({
    config: YOUTUBE_SESSION_CONFIG,
    refreshSession: refreshYouTubeSession,
  })
}

export async function writeYouTubeSession(session: YouTubeSession) {
  await writeOAuthSession(YOUTUBE_SESSION_CONFIG, session)
}

export async function clearYouTubeSession() {
  await clearOAuthSession(YOUTUBE_SESSION_CONFIG)
}

export function toPublicYouTubeSession(session: YouTubeSession): PublicYouTubeSession {
  return toPublicOAuthSession(session)
}

export function toPublicYouTubeStatusSession(
  session: YouTubeSession,
): PublicYouTubeStatusSession {
  return toPublicOAuthStatusSession(session)
}

export async function youtubeFetch(path: string, init: RequestInit = {}) {
  return oauthFetch(
    {
      config: YOUTUBE_SESSION_CONFIG,
      refreshSession: refreshYouTubeSession,
      baseUrl: YOUTUBE_API_BASE,
      disconnectedMessage: "YouTube is not connected.",
    },
    path,
    init,
  )
}

export async function youtubeFetchJson<T>(path: string, init: RequestInit = {}) {
  return oauthFetchJson<T, YouTubeSession>(
    {
      config: YOUTUBE_SESSION_CONFIG,
      refreshSession: refreshYouTubeSession,
      baseUrl: YOUTUBE_API_BASE,
      disconnectedMessage: "YouTube is not connected.",
    },
    path,
    init,
  )
}

async function requestGoogleToken(body: URLSearchParams): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Google token request failed (${res.status}): ${detail}`)
  }

  return res.json()
}

function toSession(data: GoogleTokenResponse, refreshToken: string): YouTubeSession {
  return {
    accessToken: data.access_token,
    refreshToken,
    tokenType: data.token_type,
    scope: data.scope || YOUTUBE_AUTH_SCOPES.join(" "),
    expiresAt: Date.now() + data.expires_in * 1000,
  }
}
