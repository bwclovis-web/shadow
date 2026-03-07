#!/usr/bin/env node
/**
 * Generates PWA icons (192x192 and 512x512) from public/images/logo.webp.
 * Run: node scripts/generate-pwa-icons.mjs
 * Requires: npm install -D sharp
 */
import { readFileSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const publicDir = join(root, "public")
const logoPath = join(publicDir, "images", "logo.webp")

async function main() {
  let sharp
  try {
    sharp = (await import("sharp")).default
  } catch {
    console.error("Missing dependency: run npm install -D sharp")
    process.exit(1)
  }

  try {
    const input = readFileSync(logoPath)
    const image = sharp(input)

    await image
      .resize(192, 192)
      .png()
      .toFile(join(publicDir, "icon-192x192.png"))
    console.log("Created public/icon-192x192.png")

    await sharp(input)
      .resize(512, 512)
      .png()
      .toFile(join(publicDir, "icon-512x512.png"))
    console.log("Created public/icon-512x512.png")
  } catch (err) {
    if (err.code === "ENOENT" && err.path === logoPath) {
      console.error("Logo not found at public/images/logo.webp. Add the file or create icon-192x192.png and icon-512x512.png manually in public/.")
    } else {
      console.error(err)
    }
    process.exit(1)
  }
}

main()
