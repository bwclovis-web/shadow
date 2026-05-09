import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "**/test/utils/**"],
    server: {
      deps: {
        inline: ["next-view-transitions"],
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "~": path.resolve(__dirname, "."),
      // next-view-transitions resolves `next/link` without extension; Vitest needs the explicit file
      "next/link": path.resolve(__dirname, "node_modules/next/link.js"),
    },
  },
})
