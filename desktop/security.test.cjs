const test = require('node:test')
const assert = require('node:assert/strict')
const { authorizedRequest, fileReadAllowed, isOAuthCallback, sameOrigin, ORIGIN } = require('./security.cjs')

test('local server requires its private token, exact host, and trusted origin', () => {
  const request = { headers: { host: '127.0.0.1:47820', 'x-flowcast-session': 'secret' } }
  assert.equal(authorizedRequest(request, 'secret'), true)
  for (const headers of [
    { host: '127.0.0.1:47820' },
    { ...request.headers, origin: 'https://untrusted.example' },
    { ...request.headers, host: 'rebind.example:47820' },
    { ...request.headers, 'x-flowcast-session': 'wrong' },
  ]) assert.equal(authorizedRequest({ headers }, 'secret'), false)
})

test('external browser can reach only a callback with well-formed state', () => {
  const request = { method: 'GET', headers: { host: '127.0.0.1:47820' }, url: `/api/spotify/callback?state=${'a'.repeat(48)}&code=test` }
  assert.equal(isOAuthCallback(request), true)
  assert.equal(isOAuthCallback({ ...request, method: 'POST' }), false)
  assert.equal(isOAuthCallback({ ...request, url: '/api/spotify/token' }), false)
  assert.equal(isOAuthCallback({ ...request, url: '/api/spotify/callback?state=invalid' }), false)
  assert.equal(isOAuthCallback({ ...request, headers: { host: 'evil.example' } }), false)
})

test('native bridge origin checks reject lookalikes and alternate ports', () => {
  assert.equal(sameOrigin(`${ORIGIN}/slideshow`), true)
  for (const url of ['file:///etc/passwd', 'https://127.0.0.1:47820', 'http://127.0.0.1:47821', 'http://127.0.0.1.evil.example:47820', 'invalid']) {
    assert.equal(sameOrigin(url), false)
  }
})

test('picked videos and folders can be read, never written, and only by the app', () => {
  assert.equal(fileReadAllowed(`${ORIGIN}/`, { fileAccessType: 'readable', isDirectory: false }), true)
  assert.equal(fileReadAllowed(`${ORIGIN}/`, { fileAccessType: 'readable', isDirectory: true }), true)
  assert.equal(fileReadAllowed(`${ORIGIN}/`, { fileAccessType: 'writable', isDirectory: false }), false)
  assert.equal(fileReadAllowed('https://untrusted.example/', { fileAccessType: 'readable' }), false)
  assert.equal(fileReadAllowed(`${ORIGIN}/`, undefined), false)
})
