import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export function readPackageJson(cwd: string): Record<string, unknown> {
  try {
    const content = readFileSync(join(cwd, 'package.json'), 'utf8')
    const parsed = JSON.parse(content)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}
