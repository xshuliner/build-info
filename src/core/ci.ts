import type { BuildInfo } from '../types'

export function collectCiInfo(commit: string): BuildInfo['ci'] | undefined {
  const env = process.env

  if (env.GITHUB_ACTIONS) {
    const serverUrl = env.GITHUB_SERVER_URL || 'https://github.com'
    const repository = env.GITHUB_REPOSITORY || ''
    const runId = env.GITHUB_RUN_ID || ''
    const resolvedCommit = commit || env.GITHUB_SHA || ''
    return {
      provider: 'github-actions',
      runId,
      runNumber: env.GITHUB_RUN_NUMBER || '',
      workflow: env.GITHUB_WORKFLOW || '',
      jobUrl: repository && runId ? `${serverUrl}/${repository}/actions/runs/${runId}` : '',
      commitUrl: repository && resolvedCommit ? `${serverUrl}/${repository}/commit/${resolvedCommit}` : ''
    }
  }

  if (env.GITLAB_CI) {
    return {
      provider: 'gitlab-ci',
      runId: env.CI_PIPELINE_ID || '',
      jobUrl: env.CI_PIPELINE_URL || '',
      commitUrl: env.CI_PROJECT_URL && env.CI_COMMIT_SHA ? `${env.CI_PROJECT_URL}/-/commit/${env.CI_COMMIT_SHA}` : ''
    }
  }

  if (env.VERCEL) {
    return {
      provider: 'vercel',
      runId: env.VERCEL_GIT_COMMIT_SHA || '',
      jobUrl: env.VERCEL_URL ? `https://${env.VERCEL_URL}` : '',
      commitUrl: ''
    }
  }

  if (env.CF_PAGES) {
    return {
      provider: 'cloudflare-pages',
      runId: env.CF_PAGES_COMMIT_SHA || '',
      jobUrl: env.CF_PAGES_URL || '',
      commitUrl: ''
    }
  }

  return undefined
}
