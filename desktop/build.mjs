import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
process.chdir(root)
// Desktop OAuth client registrations; gitignored, and never the website's .env.
try { process.loadEnvFile('.env.desktop') } catch { /* optional */ }
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}`)
}
const stage = path.join(root, 'desktop/stage')
if (!process.argv.includes('--stage-only')) {
  run(process.execPath, ['node_modules/next/dist/bin/next', 'build'], {
    env: { ...process.env, FLOWCAST_DESKTOP_BUILD: '1' },
  })
  run('swift', ['build', '-c', 'release', '--arch', 'arm64'], { cwd: path.join(root, 'voice-helper') })
}
await rm(stage, { recursive: true, force: true })
await mkdir(stage, { recursive: true })
const safeFile = (source) => !path.basename(source).startsWith('.env')
await cp('.next/standalone', `${stage}/server`, { recursive: true, filter: safeFile })
await cp('.next/static', `${stage}/server/.next/static`, { recursive: true })
await cp('public', `${stage}/server/public`, { recursive: true,
  filter: (source) => !source.startsWith(path.join('public', 'downloads')) })
await mkdir(`${stage}/voice`, { recursive: true })
const swiftBuild = 'voice-helper/.build/arm64-apple-macosx/release'
await cp(`${swiftBuild}/FlowCastVoice`, `${stage}/voice/FlowCastVoice`)
for (const name of await readdir(swiftBuild)) {
  if (name.endsWith('.bundle') || name.endsWith('.dylib')) await cp(`${swiftBuild}/${name}`, `${stage}/voice/${name}`, { recursive: true })
}
// SwiftPM copies resources read-only, which codesign cannot sign in place.
run('chmod', ['-R', 'u+w', `${stage}/voice`])
const pkg = JSON.parse(await readFile('package.json', 'utf8'))
await mkdir(`${stage}/shell`, { recursive: true })
for (const name of await readdir('desktop')) {
  if (name.endsWith('.cjs') && !name.endsWith('.test.cjs') && !['builder.cjs'].includes(name)) await cp(`desktop/${name}`, `${stage}/shell/${name}`)
}
await writeFile(`${stage}/shell/package.json`, JSON.stringify({
  name: 'flowcast', productName: 'FlowCast', version: pkg.version, main: 'main.cjs',
  description: 'Scripture, songs, media, and live transcription for church presentations',
  author: 'Kelvin Amoaba', private: true,
}, null, 2))
// These are desktop client registrations, never the production website credentials.
await writeFile(`${stage}/oauth-clients.json`, JSON.stringify({
  spotifyClientId: process.env.FLOWCAST_SPOTIFY_CLIENT_ID || '',
  googleClientId: process.env.FLOWCAST_GOOGLE_CLIENT_ID || '',
  googleDesktopClientSecret: process.env.FLOWCAST_GOOGLE_CLIENT_SECRET || '',
}, null, 2))
console.log('Desktop application staged. Run bun run desktop:start or bun run desktop:package.')
