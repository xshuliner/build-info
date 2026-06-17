export function pickEnv(names: string[], env: NodeJS.ProcessEnv = process.env): string {
  for (const name of names) {
    const value = env[name]
    if (typeof value === 'string' && value.trim() !== '') {
      return value
    }
  }

  return ''
}
