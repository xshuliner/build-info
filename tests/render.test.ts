import { describe, expect, it } from 'vitest'
import { renderBuildInfoScript } from '../src/core/render'
import type { BuildInfo } from '../src/types'

describe('renderBuildInfoScript', () => {
  it('renders a safe browser script', () => {
    const script = renderBuildInfoScript(sampleInfo(), { globalName: '__custom__' })

    expect(script).toContain('__custom__')
    expect(script).toContain('Object.freeze')
    expect(script).toContain("Object.defineProperty(info, 'print'")
    expect(script).not.toContain('</script>')
    expect(script).toContain('\\u003c/script>')
  })
})

function sampleInfo(): BuildInfo {
  return {
    tagVersion: 'v1.0.0',
    app: {
      name: '</script><script>alert(1)</script>',
      version: '1.0.0',
      env: 'test',
      mode: 'client'
    },
    build: {
      time: '2026-06-17T00:00:00.000Z',
      timestamp: 1781654400000,
      user: 'tester',
      machine: 'local',
      nodeVersion: 'v20.0.0',
      packageManager: 'pnpm'
    },
    git: {
      branch: 'main',
      tag: '',
      nearestTag: '',
      commit: 'abcdef1234567890',
      shortCommit: 'abcdef1',
      commitTime: '2026-06-17T00:00:00.000Z',
      dirty: false,
      remote: 'https://github.com/foo/bar',
      latestCommits: []
    },
    deploy: {
      target: 'production',
      releaseId: 'abcdef1-1781654400000'
    },
    runtime: {
      publicPath: '/'
    }
  }
}
