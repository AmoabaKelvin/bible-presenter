// Regenerate PWA app icons from the flowwww waves mark.
// Run with: bun scripts/generate-icons.mjs
import sharp from "sharp"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const publicDir = join(root, "public")

const BG = "#0a0a0a"
const STROKE = "#fafafa"

// Three sine-wave strokes, drawn on a 32-unit grid, nudged to sit centered.
const waves = (opacityOuter = 0.5) => `
  <g transform="translate(1.5,0)" stroke="${STROKE}" stroke-width="2.4"
     stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M4 11q3.5-4 7 0t7 0 7 0" opacity="${opacityOuter}"/>
    <path d="M4 16q3.5-4 7 0t7 0 7 0"/>
    <path d="M4 21q3.5-4 7 0t7 0 7 0" opacity="${opacityOuter}"/>
  </g>`

// Rounded-square icon (any purpose).
const anySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect x="0" y="0" width="32" height="32" rx="6.5" fill="${BG}"/>
  ${waves()}
</svg>`

// Full-bleed icon for maskable (OS applies its own mask) and Apple touch.
// Slightly smaller waves keep them inside the maskable safe zone.
const fullBleedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect x="0" y="0" width="32" height="32" fill="${BG}"/>
  <g transform="translate(16,16) scale(0.8) translate(-16,-16)">${waves()}</g>
</svg>`

const targets = [
  { svg: anySvg, size: 192, file: "icon-192.png" },
  { svg: anySvg, size: 512, file: "icon-512.png" },
  { svg: fullBleedSvg, size: 512, file: "icon-maskable-512.png" },
  { svg: fullBleedSvg, size: 180, file: "apple-touch-icon.png" },
]

for (const { svg, size, file } of targets) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(join(publicDir, file))
  console.log(`wrote public/${file} (${size}x${size})`)
}
