import path from "node:path"

// Turbopack sometimes runs PostCSS with an empty `from`, which makes Tailwind
// resolve `@import "tailwindcss"` from the parent of the project folder.
const ensureFrom = () => ({
  postcssPlugin: "ensure-from",
  Once(_root, { result }) {
    if (!result.opts.from) {
      result.opts.from = path.join(process.cwd(), "app", "globals.css")
    }
  },
})
ensureFrom.postcss = true

const config = {
  plugins: [ensureFrom, ["@tailwindcss/postcss", {}]],
};

export default config;
