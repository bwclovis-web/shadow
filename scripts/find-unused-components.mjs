import fs from "fs"
import path from "path"

const ROOT = process.cwd()
const isTest = (f) => /\.(test|spec)\.(tsx?|jsx?)$/.test(f)

/** Collect candidate component package directories */
const collectPackages = () => {
  const packages = []

  const addDir = (dir) => {
    const norm = dir.split(path.sep).join("/")
    if (!norm.startsWith("components/")) return
    const name = path.basename(dir)
    packages.push({ dir: norm, name, slug: norm.replace(/^components\//, "") })
  }

  for (const tier of ["Atoms", "Molecules", "Organisms"]) {
    const tierPath = path.join("components", tier)
    if (!fs.existsSync(tierPath)) continue
    for (const e of fs.readdirSync(tierPath, { withFileTypes: true })) {
      if (e.isDirectory()) addDir(path.join(tierPath, e.name))
    }
  }

  const containersPath = path.join("components", "Containers")
  if (fs.existsSync(containersPath)) {
    for (const e of fs.readdirSync(containersPath, { withFileTypes: true })) {
      if (!e.isDirectory()) continue
      const top = path.join(containersPath, e.name)
      addDir(top)
      // one more level for nested packages (e.g. TraderProfile/ScentDnaCard)
      for (const sub of fs.readdirSync(top, { withFileTypes: true })) {
        if (!sub.isDirectory()) continue
        if (["bones", "Partials", "components", "utils", "hooks"].includes(sub.name))
          continue
        const subPath = path.join(top, sub.name)
        const hasTsx = fs
          .readdirSync(subPath)
          .some((f) => f.endsWith(".tsx") && !isTest(f))
        if (hasTsx) addDir(subPath)
      }
    }
  }

  for (const e of fs.readdirSync("components", { withFileTypes: true })) {
    if (
      e.isDirectory() &&
      !["Atoms", "Molecules", "Organisms", "Containers"].includes(e.name)
    ) {
      addDir(path.join("components", e.name))
    }
  }

  return packages
}

const readSources = () => {
  const out = []
  const scan = (dir) => {
    if (!fs.existsSync(dir)) return
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (["node_modules", ".next", ".git"].includes(e.name)) continue
        scan(p)
      } else if (/\.(tsx?|jsx?|mdx?)$/.test(e.name) && !isTest(e.name)) {
        out.push({
          path: path.relative(ROOT, p).split(path.sep).join("/"),
          content: fs.readFileSync(p, "utf8"),
        })
      }
    }
  }
  for (const root of [
    "app",
    "lib",
    "hooks",
    "utils",
    "constants",
    "providers",
    "contexts",
    "components",
    "middleware.ts",
  ]) {
    if (root === "middleware.ts") {
      if (fs.existsSync(root))
        out.push({ path: root, content: fs.readFileSync(root, "utf8") })
    } else scan(path.join(ROOT, root))
  }
  return out
}

const hasExternalUse = (sources, pkg) => {
  const { dir, name, slug } = pkg
  for (const { path: filePath, content } of sources) {
    if (filePath === dir || filePath.startsWith(`${dir}/`)) continue

    if (
      content.includes(`~/components/${slug}`) ||
      content.includes(`@/components/${slug}`) ||
      content.includes(`components/${slug}`)
    ) {
      return { used: true, by: filePath }
    }

    const importRe = new RegExp(
      `import\\s+(?:type\\s+)?(?:\\{[^}]*\\b${name}\\b[^}]*\\}|${name}\\b)[^;]*from\\s+['"][^'"]+['"]`,
    )
    if (importRe.test(content)) return { used: true, by: filePath }
  }
  return { used: false }
}

const packages = collectPackages()
const sources = readSources()
const unused = []
let usedCount = 0

for (const pkg of packages.sort((a, b) => a.dir.localeCompare(b.dir))) {
  const result = hasExternalUse(sources, pkg)
  if (!result.used) unused.push(pkg)
  else usedCount++
}

const byTier = (prefix) => unused.filter((u) => u.dir.startsWith(prefix))

console.log("=== UNUSED (no import from outside package dir, excl. tests) ===\n")

for (const tier of [
  "components/Atoms/",
  "components/Molecules/",
  "components/Organisms/",
  "components/Containers/",
]) {
  const items = byTier(tier)
  if (items.length === 0) continue
  console.log(`## ${tier.replace("components/", "").replace(/\/$/, "")}`)
  for (const u of items) console.log(`  ${u.dir}`)
  console.log()
}

const other = unused.filter(
  (u) =>
    !u.dir.startsWith("components/Atoms/") &&
    !u.dir.startsWith("components/Molecules/") &&
    !u.dir.startsWith("components/Organisms/") &&
    !u.dir.startsWith("components/Containers/"),
)
if (other.length) {
  console.log("## Other")
  for (const u of other) console.log(`  ${u.dir}`)
  console.log()
}

console.log(
  `Summary: ${unused.length} unused / ${packages.length} packages (${usedCount} used)`,
)
