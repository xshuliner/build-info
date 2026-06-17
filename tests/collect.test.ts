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
})

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'xbi-'))
  tempDirs.push(dir)
  return dir
}
