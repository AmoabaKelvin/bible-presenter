import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto"
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs"
import path from "node:path"

export function isDesktopRuntime() {
  return process.env.FLOWCAST_DESKTOP_RUNTIME === "1"
}

function key() {
  const secret = process.env.FLOWCAST_DESKTOP_KEY
  if (!secret) throw new Error("Desktop session encryption is unavailable.")
  return createHash("sha256").update(secret).digest()
}

function location(name: string) {
  const directory = process.env.FLOWCAST_DESKTOP_DATA
  if (!directory || !/^[a-zA-Z0-9]+$/.test(name)) throw new Error("Invalid desktop session location.")
  const sessions = path.join(directory, "accounts")
  mkdirSync(sessions, { recursive: true, mode: 0o700 })
  return path.join(sessions, `${name}.json.enc`)
}

export function readDesktopValue<T>(name: string, consume = false): T | null {
  try {
    const file = location(name)
    const encrypted = readFileSync(file)
    // Synchronous read + unlink makes OAuth state consumption single-use in this process.
    if (consume) unlinkSync(file)
    const decipher = createDecipheriv("aes-256-gcm", key(), encrypted.subarray(0, 12))
    decipher.setAuthTag(encrypted.subarray(12, 28))
    return JSON.parse(Buffer.concat([decipher.update(encrypted.subarray(28)), decipher.final()]).toString("utf8")) as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
}

export function writeDesktopValue(name: string, value: unknown) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()])
  const file = location(name)
  const temporary = `${file}.tmp`
  writeFileSync(temporary, Buffer.concat([iv, cipher.getAuthTag(), encrypted]), { mode: 0o600 })
  renameSync(temporary, file)
}

export function deleteDesktopValue(name: string) {
  try { unlinkSync(location(name)) } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
}

export function desktopVerifier(state: string) {
  if (!/^[a-f0-9]{48}$/.test(state)) throw new Error("Invalid desktop OAuth state.")
  return createHmac("sha256", key()).update(state).digest("base64url")
}

export function addDesktopChallenge(url: URL, state: string) {
  if (!isDesktopRuntime()) return
  url.searchParams.set("code_challenge_method", "S256")
  url.searchParams.set("code_challenge", createHash("sha256").update(desktopVerifier(state)).digest("base64url"))
}

export function desktopCallbackResponse(success: boolean) {
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>FlowCast</title></head><body><h1>${success ? "Account connected" : "Account connection cancelled"}</h1><p>You can close this tab and return to FlowCast.</p></body></html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'" },
  })
}
