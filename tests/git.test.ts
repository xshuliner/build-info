import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { collectGitInfo } from '../src/core/git'

describe('collectGitInfo', () => {
  it('returns empty values for non-Git directories', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'xbi-git-'))

    try {
      const git = collectGitInfo(cwd)

      expect(git.commit).toBe('')
      expect(git.shortCommit).toBe('')
      expect(git.latestCommits).toEqual([])
      expect(git.dirty).toBe(false)
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })
})
