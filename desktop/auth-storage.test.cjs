const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createHash } = require('node:crypto')

test('desktop accounts are encrypted, authenticated, and support single-use values', async () => {
  const storage = await import('../lib/desktop-auth-storage.ts')
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'flowcast-auth-test-'))
  process.env.FLOWCAST_DESKTOP_DATA = directory
  process.env.FLOWCAST_DESKTOP_KEY = 'test-key-only'
  process.env.FLOWCAST_DESKTOP_RUNTIME = '1'
  try {
    const session = { accessToken: 'private-access-token', refreshToken: 'private-refresh-token' }
    storage.writeDesktopValue('account', session)
    const file = path.join(directory, 'accounts/account.json.enc')
    assert.equal(fs.readFileSync(file).includes(Buffer.from(session.accessToken)), false)
    assert.deepEqual(storage.readDesktopValue('account'), session)
    process.env.FLOWCAST_DESKTOP_KEY = 'incorrect-key'
    assert.throws(() => storage.readDesktopValue('account'))
    process.env.FLOWCAST_DESKTOP_KEY = 'test-key-only'
    assert.deepEqual(storage.readDesktopValue('account', true), session)
    assert.equal(storage.readDesktopValue('account'), null)
    assert.throws(() => storage.writeDesktopValue('../outside', session))
    const state = 'a'.repeat(48)
    const url = new URL('https://accounts.spotify.com/authorize')
    storage.addDesktopChallenge(url, state)
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
    assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update(storage.desktopVerifier(state)).digest('base64url'))
    assert.notEqual(storage.desktopVerifier(state), storage.desktopVerifier('b'.repeat(48)))
    assert.throws(() => storage.desktopVerifier('invalid'))
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
    delete process.env.FLOWCAST_DESKTOP_DATA
    delete process.env.FLOWCAST_DESKTOP_KEY
    delete process.env.FLOWCAST_DESKTOP_RUNTIME
  }
})
