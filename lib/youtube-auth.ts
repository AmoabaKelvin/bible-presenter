import { cookies } from "next/headers"
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto"

const GOOGLE_ACCOUNTS_BASE = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
export const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"

const TOKEN_COOKIE = "flowcastYouTubeSession"
const STATE_COOKIE = "flowcastYouTubeState"
const RETURN_COOKIE = "flowcastYouTubeReturnTo"
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
const STATE_MAX_AGE_SECONDS = 60 * 10

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

export interface YouTubeSession {
  accessToken: string
  refreshToken: string
  tokenType: string
  scope: string
  expiresAt: number
}

export interface PublicYouTubeSession {
  accessToken: string
  tokenType: string
  scope: string
  expiresAt: number
  expiresIn: number
}

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
  return randomBytes(24).toString("base64url")
}

export async function setYouTubeLoginCookies(state: string, returnTo: string) {
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

export async function consumeYouTubeLoginState(receivedState: string | null) {
  const store = await cookies()
  const expected = store.get(STATE_COOKIE)?.value ?? null
  store.delete(STATE_COOKIE)

  if (!receivedState || !expected) return false
  const received = Buffer.from(receivedState)
  const stored = Buffer.from(expected)
  if (received.length !== stored.length) return false
  return timingSafeEqual(received, stored)
}

export async function consumeYouTubeReturnTo() {
  const store = await cookies()
  const returnTo = store.get(RETURN_COOKIE)?.value || "/"
  store.delete(RETURN_COOKIE)
  return sanitizeReturnTo(returnTo)
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
  const store = await cookies()
  const raw = store.get(TOKEN_COOKIE)?.value
  if (!raw) return null
  try {
    return decryptSession(raw)
  } catch {
    return null
  }
}

export async function getFreshYouTubeSession() {
  const session = await readYouTubeSession()
  if (!session) return null
  if (session.expiresAt - Date.now() > 60_000) return session

  const refreshed = await refreshYouTubeSession(session)
  await writeYouTubeSession(refreshed)
  return refreshed
}

export async function writeYouTubeSession(session: YouTubeSession) {
  const store = await cookies()
  store.set(TOKEN_COOKIE, encryptSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  })
}

export async function clearYouTubeSession() {
  const store = await cookies()
  store.delete(TOKEN_COOKIE)
  store.delete(STATE_COOKIE)
  store.delete(RETURN_COOKIE)
}

export function toPublicYouTubeSession(session: YouTubeSession): PublicYouTubeSession {
  return {
    accessToken: session.accessToken,
    tokenType: session.tokenType,
    scope: session.scope,
    expiresAt: session.expiresAt,
    expiresIn: Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000)),
  }
}

export async function youtubeFetch(path: string, init: RequestInit = {}) {
  const session = await getFreshYouTubeSession()
  if (!session) {
    return Response.json({ error: "YouTube is not connected." }, { status: 401 })
  }

  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${session.accessToken}`)

  const res = await fetch(`${YOUTUBE_API_BASE}${path}`, {
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

export async function youtubeFetchJson<T>(path: string, init: RequestInit = {}) {
  const session = await getFreshYouTubeSession()
  if (!session) {
    return { ok: false as const, status: 401, data: { error: "YouTube is not connected." } }
  }

  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${session.accessToken}`)

  const res = await fetch(`${YOUTUBE_API_BASE}${path}`, {
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

function encryptSession(session: YouTubeSession) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", getCookieKey(), iv)
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(session), "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".")
}

function decryptSession(value: string): YouTubeSession {
  const [ivRaw, tagRaw, ciphertextRaw] = value.split(".")
  if (!ivRaw || !tagRaw || !ciphertextRaw) throw new Error("Invalid YouTube session cookie.")

  const iv = Buffer.from(ivRaw, "base64url")
  const tag = Buffer.from(tagRaw, "base64url")
  const ciphertext = Buffer.from(ciphertextRaw, "base64url")
  const decipher = createDecipheriv("aes-256-gcm", getCookieKey(), iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
  return JSON.parse(plaintext) as YouTubeSession
}

function getCookieKey() {
  const secret =
    process.env.GOOGLE_COOKIE_SECRET ||
    process.env.YOUTUBE_COOKIE_SECRET ||
    process.env.SPOTIFY_COOKIE_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.YOUTUBE_CLIENT_SECRET
  if (!secret) {
    throw new Error("Missing YouTube cookie secret. Set GOOGLE_COOKIE_SECRET.")
  }
  return createHash("sha256").update(secret).digest()
}
