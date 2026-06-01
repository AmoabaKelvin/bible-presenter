import { cookies } from "next/headers"
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto"

export interface OAuthSession {
  accessToken: string
  refreshToken: string
  tokenType: string
  scope: string
  expiresAt: number
}

export interface PublicOAuthSession {
  accessToken: string
  tokenType: string
  scope: string
  expiresAt: number
  expiresIn: number
}

export interface PublicOAuthStatusSession {
  scope: string
  expiresAt: number
  expiresIn: number
}

export interface OAuthSessionConfig {
  tokenCookie: string
  stateCookie: string
  returnCookie: string
  cookieMaxAgeSeconds: number
  stateMaxAgeSeconds: number
  secretCandidates: () => Array<string | undefined>
  missingSecretMessage: string
  invalidCookieMessage: string
}

interface FreshOAuthSessionOptions<T extends OAuthSession> {
  config: OAuthSessionConfig
  refreshSession: (session: T) => Promise<T>
}

interface OAuthFetchOptions<T extends OAuthSession> extends FreshOAuthSessionOptions<T> {
  baseUrl: string
  disconnectedMessage: string
}

export function makeOAuthState() {
  return randomBytes(24).toString("base64url")
}

export async function setOAuthLoginCookies(
  config: OAuthSessionConfig,
  state: string,
  returnTo: string,
) {
  const store = await cookies()
  const secure = process.env.NODE_ENV === "production"
  store.set(config.stateCookie, state, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: config.stateMaxAgeSeconds,
  })
  store.set(config.returnCookie, returnTo, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: config.stateMaxAgeSeconds,
  })
}

export async function consumeOAuthLoginState(
  config: OAuthSessionConfig,
  receivedState: string | null,
) {
  const store = await cookies()
  const expected = store.get(config.stateCookie)?.value ?? null
  store.delete(config.stateCookie)

  if (!receivedState || !expected) return false
  const received = Buffer.from(receivedState)
  const stored = Buffer.from(expected)
  if (received.length !== stored.length) return false
  return timingSafeEqual(received, stored)
}

export async function consumeOAuthReturnTo(config: OAuthSessionConfig) {
  const store = await cookies()
  const returnTo = store.get(config.returnCookie)?.value || "/"
  store.delete(config.returnCookie)
  return sanitizeReturnTo(returnTo)
}

export async function readOAuthSession<T extends OAuthSession>(config: OAuthSessionConfig) {
  const store = await cookies()
  const raw = store.get(config.tokenCookie)?.value
  if (!raw) return null
  try {
    return decryptSession<T>(config, raw)
  } catch {
    return null
  }
}

export async function getFreshOAuthSession<T extends OAuthSession>({
  config,
  refreshSession,
}: FreshOAuthSessionOptions<T>) {
  const session = await readOAuthSession<T>(config)
  if (!session) return null
  if (session.expiresAt - Date.now() > 60_000) return session

  const refreshed = await refreshSession(session)
  await writeOAuthSession(config, refreshed)
  return refreshed
}

export async function writeOAuthSession<T extends OAuthSession>(
  config: OAuthSessionConfig,
  session: T,
) {
  const store = await cookies()
  store.set(config.tokenCookie, encryptSession(config, session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: config.cookieMaxAgeSeconds,
  })
}

export async function clearOAuthSession(config: OAuthSessionConfig) {
  const store = await cookies()
  store.delete(config.tokenCookie)
  store.delete(config.stateCookie)
  store.delete(config.returnCookie)
}

export function toPublicOAuthSession<T extends OAuthSession>(session: T): PublicOAuthSession {
  return {
    accessToken: session.accessToken,
    tokenType: session.tokenType,
    scope: session.scope,
    expiresAt: session.expiresAt,
    expiresIn: Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000)),
  }
}

export function toPublicOAuthStatusSession<T extends OAuthSession>(
  session: T,
): PublicOAuthStatusSession {
  const publicSession = toPublicOAuthSession(session)
  return {
    scope: publicSession.scope,
    expiresAt: publicSession.expiresAt,
    expiresIn: publicSession.expiresIn,
  }
}

export async function oauthFetch<T extends OAuthSession>(
  { baseUrl, disconnectedMessage, ...sessionOptions }: OAuthFetchOptions<T>,
  path: string,
  init: RequestInit = {},
) {
  const session = await getFreshOAuthSession(sessionOptions)
  if (!session) {
    return Response.json({ error: disconnectedMessage }, { status: 401 })
  }

  const res = await fetchWithOAuthSession(baseUrl, path, session, init)
  const text = await res.text()
  return new Response(text, {
    status: res.status,
    statusText: res.statusText,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json",
    },
  })
}

export async function oauthFetchJson<TData, TSession extends OAuthSession>(
  { baseUrl, disconnectedMessage, ...sessionOptions }: OAuthFetchOptions<TSession>,
  path: string,
  init: RequestInit = {},
) {
  const session = await getFreshOAuthSession(sessionOptions)
  if (!session) {
    return { ok: false as const, status: 401, data: { error: disconnectedMessage } }
  }

  const res = await fetchWithOAuthSession(baseUrl, path, session, init)
  const data = (await res.json().catch(() => null)) as TData
  return { ok: res.ok, status: res.status, data }
}

function sanitizeReturnTo(value: string) {
  if (!value.startsWith("/")) return "/"
  if (value.startsWith("//")) return "/"
  return value
}

function fetchWithOAuthSession<T extends OAuthSession>(
  baseUrl: string,
  path: string,
  session: T,
  init: RequestInit,
) {
  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${session.accessToken}`)

  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  })
}

function encryptSession<T extends OAuthSession>(config: OAuthSessionConfig, session: T) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", getCookieKey(config), iv)
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(session), "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".")
}

function decryptSession<T extends OAuthSession>(config: OAuthSessionConfig, value: string): T {
  const [ivRaw, tagRaw, ciphertextRaw] = value.split(".")
  if (!ivRaw || !tagRaw || !ciphertextRaw) throw new Error(config.invalidCookieMessage)

  const iv = Buffer.from(ivRaw, "base64url")
  const tag = Buffer.from(tagRaw, "base64url")
  const ciphertext = Buffer.from(ciphertextRaw, "base64url")
  const decipher = createDecipheriv("aes-256-gcm", getCookieKey(config), iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
  return JSON.parse(plaintext) as T
}

function getCookieKey(config: OAuthSessionConfig) {
  const secret = config.secretCandidates().find(Boolean)
  if (!secret) throw new Error(config.missingSecretMessage)
  return createHash("sha256").update(secret).digest()
}
