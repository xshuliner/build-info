import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { collectBuildInfo } from '../src/core/collect'

const originalEnv = { ...process.env }
const tempDirs: string[] = []

afterEach(() => {
  process.env = { ...originalEnv }
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('collectBuildInfo', () => {
  it('does not throw outside a Git repository without package.json', () => {
    const cwd = createTempDir()
    const info = collectBuildInfo({ cwd })

    expect(info.app.name).toBe('unknown-app')
    expect(info.tagVersion).toBe('')
    expect(info.git.commit).toBe('')
    expect(info.git.latestCommits).toEqual([])
    expect(info.runtime?.publicPath).toBe('/')
  })

  it('lets environment variables override package.json', () => {
    const cwd = createTempDir()
    writeFileSync(join(cwd, 'package.json'), '{"name":"pkg-name","version":"1.2.3"}')
    process.env.XSHULINER_APP_NAME = 'env-name'
    process.env.XSHULINER_APP_VERSION = '2.0.0'
    process.env.XSHULINER_APP_ENV = 'production'

    const info = collectBuildInfo({ cwd })

    expect(info.app.name).toBe('env-name')
    expect(info.app.version).toBe('2.0.0')
    expect(info.app.env).toBe('production')
  })

  it('uses the latest reachable Git tag as tagVersion', () => {
    const cwd = createTempDir()
    runGit(cwd, 'git -c init.defaultBranch=main init')
    runGit(cwd, 'git config user.name "Test User"')
    runGit(cwd, 'git config user.email "test@example.com"')
    writeFileSync(join(cwd, 'file.txt'), 'first')
    runGit(cwd, 'git add file.txt')
    runGit(cwd, 'git commit -m "first"')
    runGit(cwd, 'git tag v1.2.3')
    writeFileSync(join(cwd, 'file.txt'), 'second')
    runGit(cwd, 'git add file.txt')
    runGit(cwd, 'git commit -m "second"')

    const info = collectBuildInfo({ cwd })

    expect(info.tagVersion).toBe('v1.2.3')
    expect(info.git.nearestTag).toBe('v1.2.3')
  })
})

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'xbi-'))
  tempDirs.push(dir)
  return dir
}

function runGit(cwd: string, command: string): void {
  execSync(command, { cwd, stdio: 'ignore' })
}
