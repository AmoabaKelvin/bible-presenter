module.exports = {
  appId: 'com.kelvinamoaba.flowcast', productName: 'FlowCast',
  directories: { app: 'desktop/stage/shell', output: 'dist', buildResources: 'desktop' },
  files: ['*.cjs', 'package.json'],
  extraResources: [
    { from: 'desktop/stage/server', to: 'server', filter: ['**/*', '!**/.env*', '!**/.next/cache/**'] },
    { from: 'desktop/stage/voice', to: 'voice' },
    { from: 'desktop/stage/oauth-clients.json', to: 'oauth-clients.json' },
  ],
  asar: true,
  // electron-builder drops node_modules from extraResources; the Next.js server cannot start without them.
  afterPack: (context) => require('node:fs/promises').cp('desktop/stage/server/node_modules',
    `${context.appOutDir}/FlowCast.app/Contents/Resources/server/node_modules`, { recursive: true }),
  mac: {
    target: [{ target: 'dmg', arch: ['arm64'] }],
    category: 'public.app-category.productivity', minimumSystemVersion: '14.0',
    icon: 'public/icon-512.png',
    // Ad-hoc signatures fail library validation under the hardened runtime; only release builds use it.
    hardenedRuntime: process.env.FLOWCAST_RELEASE === '1',
    entitlements: 'desktop/entitlements.mac.plist', entitlementsInherit: 'desktop/entitlements.mac.plist',
    binaries: ['Contents/Resources/voice/FlowCastVoice'],
    identity: process.env.FLOWCAST_RELEASE === '1' ? undefined : '-',
    notarize: process.env.FLOWCAST_RELEASE === '1',
    extendInfo: { NSMicrophoneUsageDescription: 'FlowCast listens to your selected audio input to recognize scripture references and present verses.' },
  },
  forceCodeSigning: process.env.FLOWCAST_RELEASE === '1',
  artifactName: 'FlowCast-${version}-${arch}.${ext}',
  dmg: { title: 'FlowCast', contents: [
    { x: 140, y: 180, type: 'file' },
    { x: 420, y: 180, type: 'link', path: '/Applications' },
  ] },
}
