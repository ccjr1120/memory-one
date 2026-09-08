#!/usr/bin/env node
/* eslint-env node */
/* eslint-disable no-console */
//
// Unified release-branch bump-version script.
// Drop into `scripts/bump-version.mjs` and add to package.json:
//   { "scripts": { "v": "node scripts/bump-version.mjs" } }
// Required deps: @inquirer/prompts, semver
//
// Configuration sources (highest priority first):
//   1. CLI flags
//   2. bump-version.config.{mjs,js,cjs,json} at repo root
//   3. package.json#bumpVersion
//   4. Auto-detection
//   5. Built-in defaults

import { confirm, input, select } from '@inquirer/prompts'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import semver from 'semver'

// ---------- colors ----------

const supportsColor = Boolean(process.stdout.isTTY || process.stderr.isTTY)
const colorize = (code) => (text) =>
  supportsColor ? `\u001B[${code}m${text}\u001B[0m` : String(text)
const colors = {
  info: colorize('36'),
  success: colorize('32'),
  warning: colorize('33'),
  error: colorize('31'),
  highlight: colorize('1;34'),
  dim: colorize('2')
}
const formatError = (output) =>
  output instanceof Error ? (output.stack ?? output.message) : String(output)

// ---------- runCommand ----------

function runCommand(command, args, { ignoreFailure = false, cwd } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += d.toString()))
    child.stderr.on('data', (d) => (stderr += d.toString()))
    child.on('close', (code) => {
      if (code === 0 || ignoreFailure) return resolvePromise(stdout.trim())
      rejectPromise(
        new Error(
          `Command failed: ${command} ${args.join(' ')}\n${stderr.trim()}`
        )
      )
    })
  })
}

// ---------- CLI args ----------

const HELP = `bump-version - unified release-branch tool

Usage: bump-version [options]

Options:
  --type <release|hotfix>     Release type
  --bump <patch|minor|major>  Version bump kind (or pass --version)
  --version <semver>          Explicit next version (overrides --bump)
  --base <branch>             Override base branch (auto-detected by default)
  --package <path>            Path to main package.json (default: ./package.json)
  --remote <name>             Git remote (default: origin)
  --commit-message <tpl>      Template; supports {type} {nextVersion} {prevVersion}
  --[no-]push                 Push the new branch (default: push)
  --[no-]tag                  Create & push v<version> tag (default: no tag)
  --[no-]sync-workspaces      Sync versions in sub-packages (default: auto)
  --yes, -y                   Skip confirm prompt
  --dry-run                   Show actions without modifying anything
  --help, -h                  Print this help
`

function parseArgs(argv) {
  const out = {}
  const arr = argv.slice(2)
  for (let i = 0; i < arr.length; i++) {
    const a = arr[i]
    const eat = () => arr[++i]
    switch (a) {
      case '--type':
        out.type = eat()
        break
      case '--bump':
        out.bump = eat()
        break
      case '--version':
        out.version = eat()
        break
      case '--base':
        out.base = eat()
        break
      case '--package':
        out.packageJsonPath = eat()
        break
      case '--remote':
        out.remote = eat()
        break
      case '--commit-message':
        out.commitMessage = eat()
        break
      case '--yes':
      case '-y':
        out.yes = true
        break
      case '--dry-run':
        out.dryRun = true
        break
      case '--push':
        out.push = true
        break
      case '--no-push':
        out.push = false
        break
      case '--tag':
        out.tag = true
        break
      case '--no-tag':
        out.tag = false
        break
      case '--sync-workspaces':
        out.syncWorkspaces = true
        break
      case '--no-sync-workspaces':
        out.syncWorkspaces = false
        break
      case '--help':
      case '-h':
        out.help = true
        break
      default:
        if (a.startsWith('--') || a.startsWith('-')) {
          console.error(colors.error(`Unknown flag: ${a}`))
          process.exit(2)
        }
    }
  }
  return out
}

// ---------- config loading ----------

const DEFAULTS = {
  packageJsonPath: 'package.json',
  syncWorkspaces: 'auto',
  branchPrefixes: { release: 'release', hotfix: 'hotfix' },
  commitMessage: 'release: {type} {nextVersion}',
  remote: 'origin',
  push: true,
  tag: false
}

async function loadFileConfig(cwd) {
  for (const ext of ['.mjs', '.js', '.cjs']) {
    const p = resolve(cwd, `bump-version.config${ext}`)
    if (existsSync(p)) {
      const mod = await import(pathToFileURL(p).href)
      return mod.default ?? mod
    }
  }
  const jsonPath = resolve(cwd, 'bump-version.config.json')
  if (existsSync(jsonPath)) {
    return JSON.parse(await readFile(jsonPath, 'utf8'))
  }
  return {}
}

async function loadPkgConfig(cwd) {
  try {
    const pkg = JSON.parse(
      await readFile(resolve(cwd, 'package.json'), 'utf8')
    )
    return pkg.bumpVersion ?? {}
  } catch {
    return {}
  }
}

async function loadConfig(cli) {
  const cwd = process.cwd()
  const fileCfg = await loadFileConfig(cwd)
  const pkgCfg = await loadPkgConfig(cwd)
  return { ...DEFAULTS, ...pkgCfg, ...fileCfg, ...cli }
}

// ---------- default branch detection ----------

async function detectDefaultBranch(remote, override) {
  if (override) return override
  try {
    const ref = await runCommand('git', [
      'symbolic-ref',
      '--short',
      `refs/remotes/${remote}/HEAD`
    ])
    const last = ref.split('/').slice(-1)[0]
    if (last) return last
  } catch {
    // origin/HEAD not set; fall through
  }
  for (const candidate of ['main', 'master', 'develop']) {
    try {
      await runCommand('git', ['rev-parse', '--verify', candidate])
      return candidate
    } catch {
      // try next
    }
  }
  throw new Error(
    'Could not detect default branch. Pass --base or configure `base`.'
  )
}

// ---------- workspace discovery ----------

async function expandWorkspaceGlobs(rootDir, globs) {
  const paths = []
  for (const g of globs) {
    if (g.includes('**') || /\*[^/]/.test(g) || /[^/]\*/.test(g)) {
      console.error(
        colors.warning(`Skipping unsupported workspace glob: ${g}`)
      )
      continue
    }
    if (g.endsWith('/*')) {
      const dir = g.slice(0, -2)
      const abs = resolve(rootDir, dir)
      let entries
      try {
        entries = await readdir(abs)
      } catch {
        continue
      }
      for (const e of entries) {
        const p = join(abs, e, 'package.json')
        try {
          const s = await stat(p)
          if (s.isFile()) paths.push(p)
        } catch {
          // no package.json here, skip
        }
      }
    } else {
      const p = resolve(rootDir, g, 'package.json')
      try {
        const s = await stat(p)
        if (s.isFile()) paths.push(p)
      } catch {
        // not a package, skip
      }
    }
  }
  return paths
}

function parsePnpmWorkspaceYaml(content) {
  const pkgs = []
  let inPackages = false
  for (const raw of content.split('\n')) {
    const line = raw.replace(/#.*$/, '')
    if (/^packages\s*:/.test(line)) {
      inPackages = true
      continue
    }
    if (inPackages) {
      const match = line.match(/^\s*-\s*['"]?([^'"\s]+)['"]?/)
      if (match) {
        pkgs.push(match[1])
      } else if (line.trim() && !/^\s/.test(line)) {
        inPackages = false
      }
    }
  }
  return pkgs
}

async function readWorkspaceGlobs(rootDir) {
  // 1. package.json#workspaces
  try {
    const pkg = JSON.parse(
      await readFile(resolve(rootDir, 'package.json'), 'utf8')
    )
    let ws = pkg.workspaces
    if (ws && typeof ws === 'object' && !Array.isArray(ws)) ws = ws.packages
    if (Array.isArray(ws) && ws.length > 0) return ws
  } catch {
    // ignore
  }
  // 2. pnpm-workspace.yaml
  try {
    const yaml = await readFile(
      resolve(rootDir, 'pnpm-workspace.yaml'),
      'utf8'
    )
    const pkgs = parsePnpmWorkspaceYaml(yaml)
    if (pkgs.length > 0) return pkgs
  } catch {
    // ignore
  }
  return null
}

async function discoverWorkspacePackages(rootDir, mode) {
  if (mode === false) return []
  const declared = await readWorkspaceGlobs(rootDir)
  if (declared) return expandWorkspaceGlobs(rootDir, declared)
  // Fallback for un-declared monorepos with apps/* + packages/* layout.
  return expandWorkspaceGlobs(rootDir, ['apps/*', 'packages/*'])
}

// ---------- main ----------

function requireTTY(label, isTTY) {
  if (!isTTY) {
    console.error(
      colors.error(
        `Missing --${label} (no TTY available for interactive prompt).`
      )
    )
    process.exit(2)
  }
}

async function pickReleaseType(cfg, baseBranch, isTTY) {
  if (cfg.type) {
    if (cfg.type !== 'release' && cfg.type !== 'hotfix') {
      console.error(colors.error(`Invalid --type: ${cfg.type}`))
      process.exit(2)
    }
    return cfg.type
  }
  requireTTY('type', isTTY)
  return select({
    message: 'Select release type',
    choices: [
      {
        name: colors.highlight(`Release (from ${baseBranch})`),
        value: 'release'
      },
      {
        name: colors.highlight(`Hotfix (from ${baseBranch})`),
        value: 'hotfix'
      }
    ],
    default: 'release'
  })
}

async function pickNextVersion(cfg, currentVersion, isTTY) {
  const patch = semver.inc(currentVersion, 'patch')
  const minor = semver.inc(currentVersion, 'minor')
  const major = semver.inc(currentVersion, 'major')
  if (!patch || !minor || !major) {
    throw new Error('Failed to calculate next semantic versions.')
  }

  if (cfg.version) return cfg.version
  if (cfg.bump) {
    const map = { patch, minor, major }
    if (!map[cfg.bump]) {
      console.error(colors.error(`Invalid --bump: ${cfg.bump}`))
      process.exit(2)
    }
    return map[cfg.bump]
  }

  requireTTY('bump or --version', isTTY)
  console.log(colors.info(`Current version: ${currentVersion}`))
  const choice = await select({
    message: 'Choose a version update strategy',
    choices: [
      { name: colors.highlight(patch), value: 'patch' },
      { name: colors.highlight(minor), value: 'minor' },
      { name: colors.highlight(major), value: 'major' },
      { name: colors.highlight('Custom version'), value: 'custom' }
    ],
    default: 'patch'
  })
  if (choice === 'custom') {
    return input({
      message: 'Enter the desired version',
      default: patch,
      validate: (v) => {
        if (!semver.valid(v)) return 'Provide a valid semver (e.g. 1.2.3).'
        if (!semver.gt(v, currentVersion))
          return 'New version must be greater than current.'
        return true
      }
    })
  }
  return { patch, minor, major }[choice]
}

async function main() {
  const cli = parseArgs(process.argv)
  if (cli.help) {
    console.log(HELP)
    process.exit(0)
  }

  const cfg = await loadConfig(cli)
  const cwd = process.cwd()

  // Resolve main package.json.
  const mainPkgPath = resolve(cwd, cfg.packageJsonPath)
  if (!existsSync(mainPkgPath)) {
    console.error(
      colors.error(
        `package.json not found at ${mainPkgPath}. Set "packageJsonPath" or pass --package.`
      )
    )
    process.exit(2)
  }
  const mainPkgRaw = await readFile(mainPkgPath, 'utf8')
  let mainPkg
  try {
    mainPkg = JSON.parse(mainPkgRaw)
  } catch (err) {
    console.error(colors.error(`Failed to parse ${mainPkgPath}.`))
    console.error(colors.error(formatError(err)))
    process.exit(2)
  }
  const currentVersion = mainPkg.version
  if (!semver.valid(currentVersion)) {
    console.error(
      colors.error(
        `Invalid current version "${currentVersion}" in ${mainPkgPath}.`
      )
    )
    process.exit(2)
  }

  // Git sanity checks.
  try {
    await runCommand('git', ['rev-parse', '--is-inside-work-tree'])
  } catch (err) {
    console.error(colors.error('Not inside a Git repository.'))
    console.error(colors.error(formatError(err)))
    process.exit(3)
  }
  const treeStatus = await runCommand('git', ['status', '--porcelain'])
  if (treeStatus && !cfg.dryRun) {
    console.error(
      colors.error(
        'Working tree is not clean. Commit or stash changes before running.'
      )
    )
    process.exit(3)
  }

  const baseBranch = await detectDefaultBranch(cfg.remote, cfg.base)
  const isTTY = Boolean(process.stdin.isTTY)

  const type = await pickReleaseType(cfg, baseBranch, isTTY)
  const nextVersion = await pickNextVersion(cfg, currentVersion, isTTY)

  if (!semver.valid(nextVersion) || !semver.gt(nextVersion, currentVersion)) {
    console.error(
      colors.error(
        `Invalid next version "${nextVersion}" (must be valid semver greater than ${currentVersion}).`
      )
    )
    process.exit(2)
  }

  if (!cfg.yes && isTTY) {
    const ok = await confirm({
      message: `Update version from ${currentVersion} to ${nextVersion}?`,
      default: true
    })
    if (!ok) {
      console.log(colors.warning('Cancelled.'))
      process.exit(0)
    }
  }

  const branchPrefix = cfg.branchPrefixes?.[type] ?? type
  const targetBranch = `${branchPrefix}/${nextVersion}`

  // Refuse to clobber an existing branch.
  let branchExists = false
  try {
    await runCommand('git', ['rev-parse', '--verify', targetBranch])
    branchExists = true
  } catch {
    // ok, doesn't exist
  }
  if (branchExists) {
    console.error(
      colors.error(`Branch ${targetBranch} already exists locally.`)
    )
    process.exit(3)
  }

  // Ensure the base branch exists locally before checkout.
  try {
    await runCommand('git', ['rev-parse', '--verify', baseBranch])
  } catch (err) {
    console.error(
      colors.error(`Base branch "${baseBranch}" was not found locally.`)
    )
    console.error(colors.error(formatError(err)))
    process.exit(3)
  }

  // Discover all package.json files to update.
  const wsPkgs = await discoverWorkspacePackages(cwd, cfg.syncWorkspaces)
  const seen = new Set([mainPkgPath])
  const allPkgs = [mainPkgPath]
  for (const p of wsPkgs) {
    if (!seen.has(p)) {
      seen.add(p)
      allPkgs.push(p)
    }
  }

  console.log(colors.info(`Base branch    : ${baseBranch}`))
  console.log(colors.info(`Release type   : ${type}`))
  console.log(colors.info(`Current        : ${currentVersion}`))
  console.log(colors.info(`Next           : ${nextVersion}`))
  console.log(colors.info(`Target branch  : ${targetBranch}`))
  console.log(colors.info(`Packages       : ${allPkgs.length}`))
  for (const p of allPkgs) {
    console.log(colors.dim(`  - ${relative(cwd, p)}`))
  }

  if (cfg.dryRun) {
    console.log(colors.warning('Dry-run; no changes applied.'))
    process.exit(0)
  }

  // Switch to base, pull, branch off.
  try {
    await runCommand('git', ['checkout', baseBranch])
    await runCommand('git', ['pull', '--ff-only', cfg.remote, baseBranch], {
      ignoreFailure: true
    })
    await runCommand('git', ['checkout', '-b', targetBranch])
  } catch (err) {
    console.error(
      colors.error(`Failed to create branch ${targetBranch}.`)
    )
    console.error(colors.error(formatError(err)))
    process.exit(3)
  }

  const rollback = async (reason) => {
    console.error(colors.error(`Rolling back: ${reason}`))
    try {
      await runCommand('git', ['checkout', '--', '.'], { ignoreFailure: true })
    } catch {
      // best-effort
    }
    try {
      await runCommand('git', ['checkout', baseBranch], { ignoreFailure: true })
    } catch {
      // best-effort
    }
    try {
      await runCommand('git', ['branch', '-D', targetBranch], {
        ignoreFailure: true
      })
    } catch {
      // best-effort
    }
  }

  // Write versions.
  const updated = []
  try {
    for (const p of allPkgs) {
      const raw = await readFile(p, 'utf8')
      const pkg = JSON.parse(raw)
      if (pkg.version === undefined) continue
      pkg.version = nextVersion
      await writeFile(p, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
      updated.push(p)
    }
  } catch (err) {
    await rollback('failed writing package.json')
    console.error(colors.error(formatError(err)))
    process.exit(4)
  }

  if (updated.length === 0) {
    await rollback('no package.json contained a "version" field')
    process.exit(4)
  }

  // Commit.
  try {
    await runCommand('git', ['add', ...updated])
    const tplVars = { type, nextVersion, prevVersion: currentVersion }
    const msg = (cfg.commitMessage ?? DEFAULTS.commitMessage).replace(
      /\{(\w+)\}/g,
      (_, k) => (tplVars[k] !== undefined ? String(tplVars[k]) : '')
    )
    await runCommand('git', ['commit', '-m', msg])
  } catch (err) {
    await rollback('failed creating commit')
    console.error(colors.error(formatError(err)))
    process.exit(3)
  }

  // Tag.
  if (cfg.tag) {
    try {
      await runCommand('git', ['tag', `v${nextVersion}`])
    } catch (err) {
      console.error(
        colors.warning(
          `Failed to create tag v${nextVersion} (continuing): ${formatError(err)}`
        )
      )
    }
  }

  // Push.
  if (cfg.push) {
    try {
      await runCommand('git', [
        'push',
        '--set-upstream',
        cfg.remote,
        targetBranch
      ])
      if (cfg.tag) {
        await runCommand('git', ['push', cfg.remote, `v${nextVersion}`], {
          ignoreFailure: true
        })
      }
    } catch (err) {
      console.error(colors.error('Failed to push branch to remote.'))
      console.error(colors.error(formatError(err)))
      process.exit(3)
    }
  }

  console.log(
    colors.success(
      `Version ${nextVersion} on ${targetBranch}${cfg.push ? ' (pushed)' : ' (local only)'}.`
    )
  )
}

main().catch((err) => {
  console.error(colors.error('Unexpected error during bump-version.'))
  console.error(colors.error(formatError(err)))
  process.exit(1)
})
