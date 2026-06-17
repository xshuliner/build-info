import type { BuildInfo } from '../types'
import { safeExec } from '../utils/command'
import { sanitizeRemoteUrl } from '../utils/sanitize'
import { pickEnv } from './env'

export function collectGitInfo(cwd: string): BuildInfo['git'] {
  const commit = safeExec('git rev-parse HEAD', { cwd })
  const envBranch = pickEnv(['GITHUB_REF_NAME', 'CI_COMMIT_BRANCH', 'CF_PAGES_BRANCH'])
  const rawBranch = safeExec('git rev-parse --abbrev-ref HEAD', { cwd })
  const branch = rawBranch && rawBranch !== 'HEAD' ? rawBranch : envBranch
  const tag = safeExec('git describe --tags --exact-match HEAD', { cwd })
  const nearestTag = safeExec('git describe --tags --abbrev=0', { cwd })
  const commitTime = safeExec('git show -s --format=%cI HEAD', { cwd })
  const status = safeExec('git status --porcelain', { cwd })
  const remote = sanitizeRemoteUrl(safeExec('git config --get remote.origin.url', { cwd }))
  const latestCommits = parseLatestCommits(
    safeExec('git log -5 --date=iso-strict --pretty=format:"%H%x1f%h%x1f%an%x1f%ad%x1f%s%x1e"', {
      cwd
    })
  )

  return {
    branch,
    tag,
    nearestTag,
    commit,
    shortCommit: commit.slice(0, 7),
    commitTime,
    dirty: status.length > 0,
    remote,
    latestCommits
  }
}

function parseLatestCommits(output: string): BuildInfo['git']['latestCommits'] {
  if (!output) {
    return []
  }

  return output
    .split('\x1e')
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash = '', shortHash = '', author = '', date = '', message = ''] = record.split('\x1f')
      return { hash, shortHash, author, date, message }
    })
    .filter((commit) => commit.hash && commit.shortHash)
}
