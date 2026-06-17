import { execSync } from 'node:child_process'

export function safeExec(command: string, options: { cwd?: string } = {}): string {
  try {
    return execSync(command, {
      cwd: options.cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
  } catch {
    return ''
  }
}
