#!/usr/bin/env node

/**
 * One-time setup: create .venv-ai and install LangGraph + langchain deps for AI note extraction.
 * Uses Python 3.10+ (LangGraph has no numpy build issues).
 *
 * Usage: node scripts/setup-venv-ai.js
 * Or:    npm run clean:notes:ai:setup
 */

import { spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')
const venvDir = join(projectRoot, '.venv-ai')
const isWin = process.platform === 'win32'
const venvPython = join(venvDir, isWin ? 'Scripts' : 'bin', isWin ? 'python.exe' : 'python')
const venvExists = () => existsSync(venvPython)

function run(cmd, opts = {}) {
  return spawnSync(cmd, { shell: true, cwd: projectRoot, stdio: 'inherit', ...opts })
}

// Prefer Python 3.10+ for LangGraph / langchain compatibility
const VERSION_CHECK = 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)'

function findPython() {
  const tries = isWin
    ? ['py -3.12', 'py -3.11', 'py -3.13', 'py -3.10', 'py -3', 'python']
    : ['python3.12', 'python3.11', 'python3.13', 'python3.10', 'python3', 'python']
  for (const py of tries) {
    const { status } = run(`${py} -c "${VERSION_CHECK}"`, { stdio: 'pipe' })
    if (status === 0) return py
  }
  return null
}

function getVenvPythonVersion() {
  if (!venvExists()) return null
  const r = spawnSync(venvPython, ['--version'], { cwd: projectRoot, encoding: 'utf-8' })
  return (r.stdout || r.stderr || '').trim()
}

function main() {
  console.log('Setup: .venv-ai for clean-notes-ai.py (LangGraph)\n')

  if (venvExists()) {
    console.log('.venv-ai already exists. To reinstall deps, remove it first: rmdir /s /q .venv-ai  (Windows) or rm -rf .venv-ai  (Unix)\n')
    console.log('Installing/upgrading requirements into existing venv...')
    const quoted = venvPython.includes(' ') ? `"${venvPython}"` : venvPython
    const r = run(`${quoted} -m pip install -r scripts/requirements-ai.txt`)
    process.exit(r.status ?? 1)
    return
  }

  const python = findPython()
  if (!python) {
    console.error('No Python 3.10+ found. Install Python from https://www.python.org/downloads/')
    console.error('  Or: py -3.12 -m venv .venv-ai then .venv-ai\\Scripts\\pip install -r scripts/requirements-ai.txt')
    process.exit(1)
  }
  console.log(`Using: ${python}\n`)

  console.log('Creating .venv-ai...')
  let r = run(`${python} -m venv .venv-ai`)
  if (r.status !== 0) {
    console.error('Failed to create venv.')
    process.exit(1)
  }

  console.log('Installing requirements...')
  const quoted = venvPython.includes(' ') ? `"${venvPython}"` : venvPython
  r = run(`${quoted} -m pip install -r scripts/requirements-ai.txt`)
  if (r.status !== 0) {
    console.error('Failed to install requirements.')
    process.exit(1)
  }

  console.log('\nDone. Run: npm run clean:notes:complete:full (orchestrator will use .venv-ai)')
}

main()
