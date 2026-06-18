import { existsSync } from 'node:fs'
import { hostname, userInfo } from 'node:os'
import { join } from 'node:path'
import type { BuildInfo, GenerateBuildInfoOptions } from '../types'
import { safeExec } from '../utils/command'
import { readPackageJson } from '../utils/package'
import { collectCiInfo } from './ci'
import { pickEnv } from './env'
import { collectGitInfo } from './git'

export function collectBuildInfo(options: GenerateBuildInfoOptions = {}): BuildInfo {
  const cwd = options.cwd || process.cwd()
  const pkg = readPackageJson(cwd)
  const now = new Date()
  const timestamp = now.getTime()
  const releaseTagVersion =
    options.tagVersion || pickEnv(['XSHULINER_TAG_VERSION', 'XSHULINER_RELEASE_VERSION'])
  const git = applyReleaseTagVersion(collectGitInfo(cwd), releaseTagVersion)
  const ci = collectCiInfo(git.commit)
  const appName = options.appName || pickEnv(['XSHULINER_APP_NAME']) || stringValue(pkg.name) || 'unknown-app'
  const appVersion = options.appVersion || pickEnv(['XSHULINER_APP_VERSION']) || stringValue(pkg.version)
  const appEnv = options.env || pickEnv(['XSHULINER_APP_ENV', 'NODE_ENV']) || 'development'
  const appMode = options.mode || pickEnv(['XSHULINER_APP_MODE'])
  const releaseId = options.releaseId || pickEnv(['XSHULINER_RELEASE_ID']) || `${git.shortCommit}-${timestamp}`

  const info: BuildInfo = {
    tagVersion: releaseTagVersion || git.tag || git.nearestTag || '',
    app: {
      name: appName,
      version: appVersion,
      env: appEnv,
      mode: appMode
    },
    build: {
      time: now.toISOString(),
      timestamp,
      user: resolveBuildUser(cwd),
      machine: pickEnv(['RUNNER_NAME']) || hostname(),
      nodeVersion: process.version,
      packageManager: resolvePackageManager(cwd)
    },
    git,
    deploy: {
      target: options.deployTarget || pickEnv(['XSHULINER_DEPLOY_TARGET', 'VERCEL_ENV', 'CF_PAGES_BRANCH']),
      region: options.deployRegion || pickEnv(['XSHULINER_DEPLOY_REGION']),
      url:
        options.deployUrl ||
        pickEnv(['XSHULINER_DEPLOY_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'CF_PAGES_URL']),
      releaseId,
      buildId: options.buildId || pickEnv(['XSHULINER_BUILD_ID', 'BUILD_ID'])
    },
    runtime: {
      apiBaseUrl: pickEnv(['XSHULINER_PUBLIC_API_BASE_URL', 'NEXT_PUBLIC_API_BASE_URL', 'VITE_API_BASE_URL']),
      publicPath: pickEnv(['XSHULINER_PUBLIC_PATH']) || '/'
    }
  }

  if (ci) {
    info.ci = ci
  }

  return info
}

function applyReleaseTagVersion(git: BuildInfo['git'], tagVersion: string): BuildInfo['git'] {
  if (!tagVersion) {
    return git
  }

  return {
    ...git,
    tag: git.tag || tagVersion,
    nearestTag: tagVersion
  }
}

function resolveBuildUser(cwd: string): string {
  return (
    pickEnv(['GITHUB_ACTOR', 'GITLAB_USER_NAME', 'VERCEL_GIT_COMMIT_AUTHOR_NAME']) ||
    safeExec('git config user.name', { cwd }) ||
    safeUserName()
  )
}

function safeUserName(): string {
  try {
    return userInfo().username
  } catch {
    return ''
  }
}

function resolvePackageManager(cwd: string): string {
  const userAgent = process.env.npm_config_user_agent || ''
  if (userAgent.includes('pnpm')) {
    return 'pnpm'
  }
  if (userAgent.includes('yarn')) {
    return 'yarn'
  }
  if (userAgent.includes('npm')) {
    return 'npm'
  }

  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) {
    return 'pnpm'
  }
  if (existsSync(join(cwd, 'yarn.lock'))) {
    return 'yarn'
  }
  if (existsSync(join(cwd, 'package-lock.json'))) {
    return 'npm'
  }

  return ''
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
