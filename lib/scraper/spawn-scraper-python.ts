import { spawn, type ChildProcess } from "node:child_process"
import path from "node:path"

const resolveScraperScriptPath = (): string =>
  path.join(process.cwd(), "scraper", "run_scraper.py")

const resolveVenvPython = (): string => {
  const scraperDir = path.join(process.cwd(), "scraper")
  return process.platform === "win32"
    ? path.join(scraperDir, ".venv", "Scripts", "python.exe")
    : path.join(scraperDir, ".venv", "bin", "python")
}

/** Spawns scraper/run_scraper.py; prefers SCRAPER_PYTHON when set. */
export const spawnScraperPythonProcess = (): ChildProcess => {
  const scriptPath = resolveScraperScriptPath()
  const stdio = ["pipe", "pipe", "pipe"] as const
  const configuredPython = process.env.SCRAPER_PYTHON
  if (configuredPython) {
    return spawn(configuredPython, [scriptPath], { stdio: [...stdio] })
  }
  return spawn(resolveVenvPython(), [scriptPath], { stdio: [...stdio] })
}