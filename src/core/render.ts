import type { BuildInfo } from '../types'
import { DEFAULT_GLOBAL_NAME } from '../constants'

export function renderBuildInfoScript(
  info: BuildInfo,
  options: { globalName?: string } = {}
): string {
  const globalName = options.globalName || DEFAULT_GLOBAL_NAME
  const serialized = safeSerialize(info)
  const globalKey = safeSerialize(globalName)

  return `;(function(root) {
  var info = ${serialized}

  Object.defineProperty(info, 'print', {
    enumerable: false,
    value: function() {
      console.group('%cXshuliner Build Info', 'font-weight:bold;')
      console.log('App:', info.app.name)
      console.log('Version:', info.app.version || '')
      console.log('Env:', info.app.env)
      console.log('Build time:', info.build.time)
      console.log('Build user:', info.build.user || '')
      console.log('Branch:', info.git.branch || '')
      console.log('Tag:', info.tagVersion || info.git.tag || info.git.nearestTag || '')
      console.log('Commit:', info.git.shortCommit, info.git.commit)
      console.log('CI:', info.ci && info.ci.jobUrl ? info.ci.jobUrl : '')
      console.table(info.git.latestCommits || [])
      console.groupEnd()
      return info
    }
  })

  root[${globalKey}] = Object.freeze(info)
})(typeof window !== 'undefined' ? window : globalThis)
`
}

function safeSerialize(value: unknown): string {
  return JSON.stringify(value, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
