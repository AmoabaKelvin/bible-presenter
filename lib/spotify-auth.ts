import { SPOTIFY_AUTH_SCOPES } from "@/lib/music-url-parsers"
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

const SPOTIFY_ACCOUNTS_BASE = "https://accounts.spotify.com"
export const SPOTIFY_API_BASE = "https://api.spotify.com/v1"

const TOKEN_COOKIE = "flowcastSpotifySession"
const STATE_COOKIE = "flowcastSpotifyState"
const RETURN_COOKIE = "flowcastSpotifyReturnTo"
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
const STATE_MAX_AGE_SECONDS = 60 * 10

const SPOTIFY_SESSION_CONFIG = {
  tokenCookie: TOKEN_COOKIE,
  stateCookie: STATE_COOKIE,
  returnCookie: RETURN_COOKIE,
  cookieMaxAgeSeconds: COOKIE_MAX_AGE_SECONDS,
  stateMaxAgeSeconds: STATE_MAX_AGE_SECONDS,
  secretCandidates: () => [
    process.env.SPOTIFY_COOKIE_SECRET,
    process.env.NEXTAUTH_SECRET,
    process.env.AUTH_SECRET,
    process.env.SPOTIFY_CLIENT_SECRET,
  ],
  missingSecretMessage:
    "Missing Spotify cookie secret. Set SPOTIFY_COOKIE_SECRET or SPOTIFY_CLIENT_SECRET.",
  invalidCookieMessage: "Invalid Spotify session cookie.",
}

interface SpotifyTokenResponse {
  access_token: string
  token_type: string
  scope: string
  expires_in: number
  refresh_token?: string
}

export type SpotifySession = OAuthSession

export type PublicSpotifySession = PublicOAuthSession

export type PublicSpotifyStatusSession = PublicOAuthStatusSession

export function getSpotifyClientConfig(requestUrl?: URL) {
  const { clientId, clientSecret } = getSpotifyCredentials()
  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI ||
    (requestUrl ? `${requestUrl.origin}/api/spotify/callback` : undefined)

  if (!redirectUri) {
    throw new Error("Missing Spotify redirect URI. Set SPOTIFY_REDIRECT_URI.")
  }

  return { clientId, clientSecret, redirectUri }
}

function getSpotifyCredentials() {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing Spotify config. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.",
    )
  }

  return { clientId, clientSecret }
}

export function buildSpotifyAuthorizeUrl(requestUrl: URL, state: string) {
  const { clientId, redirectUri } = getSpotifyClientConfig(requestUrl)
  const url = new URL("/authorize", SPOTIFY_ACCOUNTS_BASE)
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("scope", SPOTIFY_AUTH_SCOPES.join(" "))
  url.searchParams.set("state", state)
  url.searchParams.set("show_dialog", "true")
  return url
}

export function makeSpotifyState() {
  return makeOAuthState()
}

export async function setSpotifyLoginCookies(state: string, returnTo: string) {
  await setOAuthLoginCookies(SPOTIFY_SESSION_CONFIG, state, returnTo)
}

export async function consumeSpotifyLoginState(receivedState: string | null) {
  return consumeOAuthLoginState(SPOTIFY_SESSION_CONFIG, receivedState)
}

export async function consumeSpotifyReturnTo() {
  return consumeOAuthReturnTo(SPOTIFY_SESSION_CONFIG)
}

export async function exchangeSpotifyCode(code: string, requestUrl: URL) {
  const { clientId, clientSecret, redirectUri } = getSpotifyClientConfig(requestUrl)
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  })
  const data = await requestSpotifyToken(body, clientId, clientSecret)
  if (!data.refresh_token) throw new Error("Spotify did not return a refresh token.")
  return toSession(data, data.refresh_token)
}

export async function refreshSpotifySession(session: SpotifySession) {
  const { clientId, clientSecret } = getSpotifyCredentials()
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: session.refreshToken,
  })
  const data = await requestSpotifyToken(body, clientId, clientSecret)
  return toSession(data, data.refresh_token || session.refreshToken)
}

export async function readSpotifySession() {
  return readOAuthSession<SpotifySession>(SPOTIFY_SESSION_CONFIG)
}

export async function getFreshSpotifySession() {
  return getFreshOAuthSession({
    config: SPOTIFY_SESSION_CONFIG,
    refreshSession: refreshSpotifySession,
  })
}

export async function writeSpotifySession(session: SpotifySession) {
  await writeOAuthSession(SPOTIFY_SESSION_CONFIG, session)
}

export async function clearSpotifySession() {
  await clearOAuthSession(SPOTIFY_SESSION_CONFIG)
}

export function toPublicSpotifySession(session: SpotifySession): PublicSpotifySession {
  return toPublicOAuthSession(session)
}

export function toPublicSpotifyStatusSession(
  session: SpotifySession,
): PublicSpotifyStatusSession {
  return toPublicOAuthStatusSession(session)
}

export async function spotifyFetch(path: string, init: RequestInit = {}) {
  return oauthFetch(
    {
      config: SPOTIFY_SESSION_CONFIG,
      refreshSession: refreshSpotifySession,
      baseUrl: SPOTIFY_API_BASE,
      disconnectedMessage: "Spotify is not connected.",
    },
    path,
    init,
  )
}

export async function spotifyFetchJson<T>(path: string, init: RequestInit = {}) {
  return oauthFetchJson<T, SpotifySession>(
    {
      config: SPOTIFY_SESSION_CONFIG,
      refreshSession: refreshSpotifySession,
      baseUrl: SPOTIFY_API_BASE,
      disconnectedMessage: "Spotify is not connected.",
    },
    path,
    init,
  )
}

async function requestSpotifyToken(
  body: URLSearchParams,
  clientId: string,
  clientSecret: string,
): Promise<SpotifyTokenResponse> {
  const res = await fetch(`${SPOTIFY_ACCOUNTS_BASE}/api/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Spotify token request failed (${res.status}): ${detail}`)
  }

  return res.json()
}

function toSession(data: SpotifyTokenResponse, refreshToken: string): SpotifySession {
  return {
    accessToken: data.access_token,
    refreshToken,
    tokenType: data.token_type,
    scope: data.scope,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
}
