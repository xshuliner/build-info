export function sanitizeRemoteUrl(remote: string | undefined): string {
  const raw = (remote || '').trim()
  if (!raw) {
    return ''
  }

  const scpLike = /^git@([^:]+):(.+)$/.exec(raw)
  if (scpLike) {
    return normalizePath(`https://${scpLike[1]}/${scpLike[2]}`)
  }

  const sshUrl = /^ssh:\/\/git@([^/]+)\/(.+)$/.exec(raw)
  if (sshUrl) {
    return normalizePath(`https://${sshUrl[1]}/${sshUrl[2]}`)
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw)
      url.username = ''
      url.password = ''
      url.search = ''
      url.hash = ''
      return normalizePath(url.toString())
    } catch {
      return ''
    }
  }

  return normalizePath(raw)
}

function normalizePath(value: string): string {
  return value.replace(/\.git\/?$/i, '').replace(/\/$/u, '')
}
