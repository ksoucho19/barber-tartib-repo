const sharp = require("sharp")
const path = require("path")
const fs = require("fs")

const sizes = [192, 512]

const svgCircle = `
<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">
  <rect width="{size}" height="{size}" rx="{size*0.2}" fill="#064e3b"/>
  <text x="{size/2}" y="{size/2}" font-family="sans-serif" font-size="{size*0.55}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">د</text>
</svg>
`

async function main() {
  const outDir = path.resolve(__dirname, "..", "public", "icons")
  fs.mkdirSync(outDir, { recursive: true })

  for (const size of sizes) {
    const svg = svgCircle.replace(/\{size\}/g, String(size))
    await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, `icon-${size}x${size}.png`))
    console.log(`Generated icon-${size}x${size}.png`)
  }

  console.log("Done generating icons.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
