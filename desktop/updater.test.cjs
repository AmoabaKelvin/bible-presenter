const test = require('node:test')
const assert = require('node:assert/strict')
const { pickRelease, newer } = require('./updater.cjs')

const release = (version, extra = {}) => ({
  tag_name: `desktop-v${version}`, draft: false,
  assets: [{ name: `FlowCast-${version}-arm64.dmg`, digest: `sha256:${'a'.repeat(64)}`, browser_download_url: `https://example.test/${version}.dmg` }],
  ...extra,
})

test('versions compare numerically', () => {
  assert.equal(newer('0.1.10', '0.1.9'), true)
  assert.equal(newer('0.2.0', '0.10.0'), false)
  assert.equal(newer('1.0.0', '1.0.0'), false)
})

test('updates to the newest published desktop release that has a checksummed disk image', () => {
  const releases = [
    { tag_name: 'voice-helper-v9', assets: [] },
    release('0.1.2'), release('0.3.0'), release('0.2.0'),
    release('0.9.0', { draft: true }),
    release('0.8.0', { assets: [{ name: 'FlowCast-0.8.0-arm64.dmg', digest: null }] }),
  ]
  assert.deepEqual(pickRelease(releases, '0.1.1'), { version: '0.3.0', url: 'https://example.test/0.3.0.dmg', sha256: 'a'.repeat(64) })
  assert.equal(pickRelease(releases, '0.3.0'), null)
  assert.equal(pickRelease({ message: 'rate limited' }, '0.1.0'), null)
})
