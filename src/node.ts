import { mkdir, writeFile } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { DEFAULT_GLOBAL_NAME, DEFAULT_OUT_DIR } from './constants'
import { collectBuildInfo } from './core/collect'
import { renderBuildInfoScript } from './core/render'
import type { GenerateBuildInfoOptions, GenerateBuildInfoResult } from './types'

export type { GenerateBuildInfoOptions, GenerateBuildInfoResult } from './types'
export { collectBuildInfo } from './core/collect'
export { collectGitInfo } from './core/git'
export { collectCiInfo } from './core/ci'
export { renderBuildInfoScript } from './core/render'
export { pickEnv } from './core/env'
export { safeExec } from './utils/command'
export { readPackageJson } from './utils/package'
export { sanitizeRemoteUrl } from './utils/sanitize'

export async function generateBuildInfo(
  options: GenerateBuildInfoOptions = {}
): Promise<GenerateBuildInfoResult> {
  const cwd = options.cwd || process.cwd()
  const outDir = options.outDir || DEFAULT_OUT_DIR
  const globalName = options.globalName || DEFAULT_GLOBAL_NAME
  const outputDir = isAbsolute(outDir) ? outDir : resolve(cwd, outDir)
  const jsonPath = join(outputDir, 'build-info.json')
  const jsPath = join(outputDir, 'build-info.js')
  const info = collectBuildInfo({ ...options, cwd })

  await mkdir(outputDir, { recursive: true })
  await writeFile(jsonPath, `${JSON.stringify(info, null, 2)}\n`, 'utf8')
  await writeFile(jsPath, renderBuildInfoScript(info, { globalName }), 'utf8')

  return { info, jsonPath, jsPath }
}
