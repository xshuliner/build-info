export interface BuildInfo {
  tagVersion: string

  app: {
    name: string
    version?: string
    env: string
    mode?: string
  }

  build: {
    time: string
    timestamp: number
    user?: string
    machine?: string
    nodeVersion?: string
    packageManager?: string
  }

  git: {
    branch?: string
    tag?: string
    nearestTag?: string
    commit: string
    shortCommit: string
    commitTime?: string
    dirty?: boolean
    remote?: string
    latestCommits: Array<{
      hash: string
      shortHash: string
      author: string
      date: string
      message: string
    }>
  }

  ci?: {
    provider?: string
    runId?: string
    runNumber?: string
    workflow?: string
    jobUrl?: string
    commitUrl?: string
  }

  deploy?: {
    target?: string
    region?: string
    url?: string
    releaseId?: string
    buildId?: string
  }

  runtime?: {
    apiBaseUrl?: string
    publicPath?: string
  }
}

export type BuildInfoWithPrint = BuildInfo & {
  print?: () => BuildInfo
}

export interface GenerateBuildInfoOptions {
  cwd?: string
  outDir?: string
  globalName?: string
  appName?: string
  appVersion?: string
  env?: string
  mode?: string
  deployTarget?: string
  deployRegion?: string
  deployUrl?: string
  releaseId?: string
  buildId?: string
}

export interface GenerateBuildInfoResult {
  info: BuildInfo
  jsonPath: string
  jsPath: string
}

declare global {
  interface Window {
    __xshuliner__?: BuildInfoWithPrint
  }
}

export {}
