import { cookies } from "next/headers"
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { SPOTIFY_AUTH_SCOPES } from "@/lib/youtube-music"

const SPOTIFY_ACCOUNTS_BASE = "https://accounts.spotify.com"
export const SPOTIFY_API_BASE = "https://api.spotify.com/v1"

const TOKEN_COOKIE = "flowwwwSpotifySession"
const STATE_COOKIE = "flowwwwSpotifyState"
const RETURN_COOKIE = "flowwwwSpotifyReturnTo"
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
const STATE_MAX_AGE_SECONDS = 60 * 10

interface SpotifyTokenResponse {
  access_token: string
  token_type: string
  scope: string
  expires_in: number
  refresh_token?: string
}

export interface SpotifySession {
  accessToken: string
  refreshToken: string
  tokenType: string
  scope: string
  expiresAt: number
}

export interface PublicSpotifySession {
  accessToken: string
  tokenType: string
  scope: string
  expiresAt: number
  expiresIn: number
}

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
  return randomBytes(24).toString("base64url")
}

export async function setSpotifyLoginCookies(state: string, returnTo: string) {
  const store = await cookies()
  const secure = process.env.NODE_ENV === "production"
  store.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: STATE_MAX_AGE_SECONDS,
  })
  store.set(RETURN_COOKIE, returnTo, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: STATE_MAX_AGE_SECONDS,
  })
}

export async function consumeSpotifyLoginState(receivedState: string | null) {
  const store = await cookies()
  const expected = store.get(STATE_COOKIE)?.value ?? null
  store.delete(STATE_COOKIE)

  if (!receivedState || !expected) return false
  const received = Buffer.from(receivedState)
  const stored = Buffer.from(expected)
  if (received.length !== stored.length) return false
  return timingSafeEqual(received, stored)
}

export async function consumeSpotifyReturnTo() {
  const store = await cookies()
  const returnTo = store.get(RETURN_COOKIE)?.value || "/"
  store.delete(RETURN_COOKIE)
  return sanitizeReturnTo(returnTo)
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
  const store = await cookies()
  const raw = store.get(TOKEN_COOKIE)?.value
  if (!raw) return null
  try {
    return decryptSession(raw)
  } catch {
    return null
  }
}

export async function getFreshSpotifySession() {
  const session = await readSpotifySession()
  if (!session) return null
  if (session.expiresAt - Date.now() > 60_000) return session

  const refreshed = await refreshSpotifySession(session)
  await writeSpotifySession(refreshed)
  return refreshed
}

export async function writeSpotifySession(session: SpotifySession) {
  const store = await cookies()
  store.set(TOKEN_COOKIE, encryptSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  })
}

export async function clearSpotifySession() {
  const store = await cookies()
  store.delete(TOKEN_COOKIE)
  store.delete(STATE_COOKIE)
  store.delete(RETURN_COOKIE)
}

export function toPublicSpotifySession(session: SpotifySession): PublicSpotifySession {
  return {
    accessToken: session.accessToken,
    tokenType: session.tokenType,
    scope: session.scope,
    expiresAt: session.expiresAt,
    expiresIn: Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000)),
  }
}

export async function spotifyFetch(path: string, init: RequestInit = {}) {
  const session = await getFreshSpotifySession()
  if (!session) {
    return Response.json({ error: "Spotify is not connected." }, { status: 401 })
  }

  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${session.accessToken}`)

  const res = await fetch(`${SPOTIFY_API_BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  })
  const text = await res.text()
  return new Response(text, {
    status: res.status,
    statusText: res.statusText,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json",
    },
  })
}

export async function spotifyFetchJson<T>(path: string, init: RequestInit = {}) {
  const session = await getFreshSpotifySession()
  if (!session) {
    return { ok: false as const, status: 401, data: { error: "Spotify is not connected." } }
  }

  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${session.accessToken}`)

  const res = await fetch(`${SPOTIFY_API_BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  })
  const data = (await res.json().catch(() => null)) as T
  return { ok: res.ok, status: res.status, data }
}

function sanitizeReturnTo(value: string) {
  if (!value.startsWith("/")) return "/"
  if (value.startsWith("//")) return "/"
  return value
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

function encryptSession(session: SpotifySession) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", getCookieKey(), iv)
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(session), "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".")
}

function decryptSession(value: string): SpotifySession {
  const [ivRaw, tagRaw, ciphertextRaw] = value.split(".")
  if (!ivRaw || !tagRaw || !ciphertextRaw) throw new Error("Invalid Spotify session cookie.")

  const iv = Buffer.from(ivRaw, "base64url")
  const tag = Buffer.from(tagRaw, "base64url")
  const ciphertext = Buffer.from(ciphertextRaw, "base64url")
  const decipher = createDecipheriv("aes-256-gcm", getCookieKey(), iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
  return JSON.parse(plaintext) as SpotifySession
}

function getCookieKey() {
  const secret =
    process.env.SPOTIFY_COOKIE_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.SPOTIFY_CLIENT_SECRET
  if (!secret) {
    throw new Error(
      "Missing Spotify cookie secret. Set SPOTIFY_COOKIE_SECRET or SPOTIFY_CLIENT_SECRET.",
    )
  }
  return createHash("sha256").update(secret).digest()
}
