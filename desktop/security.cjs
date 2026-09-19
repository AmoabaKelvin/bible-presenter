const { timingSafeEqual } = require('node:crypto')

// The smoke test gets its own port so it can run while the installed app is open.
const PORT = Number(process.env.FLOWCAST_PORT) || (process.argv.includes('--smoke-test') ? 47830 : 47820)
const ORIGIN = `http://127.0.0.1:${PORT}`

function sameOrigin(value) {
  try { return new URL(value).origin === ORIGIN } catch { return false }
}

// Media is read through picked file and folder handles. Electron re-checks a handle's
// grant with no webContents, so this must be decided from the origin alone.
function fileReadAllowed(origin, details) {
  return sameOrigin(origin) && details?.fileAccessType === 'readable'
}

function authorizedRequest(request, token) {
  if (request.headers.host !== `127.0.0.1:${PORT}`) return false
  if (request.headers.origin && request.headers.origin !== ORIGIN) return false
  const supplied = request.headers['x-flowcast-session']
  if (typeof supplied !== 'string' || !token) return false
  const actual = Buffer.from(supplied)
  const expected = Buffer.from(token)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function isOAuthCallback(request) {
  if (request.method !== 'GET' || request.headers.host !== `127.0.0.1:${PORT}`) return false
  const url = new URL(request.url, ORIGIN)
  return ['/api/spotify/callback', '/api/youtube/callback'].includes(url.pathname)
    && /^[a-f0-9]{48}$/.test(url.searchParams.get('state') || '')
}

module.exports = { PORT, ORIGIN, sameOrigin, fileReadAllowed, authorizedRequest, isOAuthCallback }
