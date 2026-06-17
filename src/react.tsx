import React, { useEffect, useMemo, useState } from 'react'
import { DEFAULT_GLOBAL_NAME, DEFAULT_JSON_SRC } from './constants'
import type { BuildInfo, BuildInfoWithPrint } from './types'
import { formatLocalMinute } from './utils/time'

export interface BuildInfoPanelProps {
  src?: string
  globalName?: string
  compact?: boolean
  className?: string
  style?: React.CSSProperties
}

export function BuildInfoPanel({
  src = DEFAULT_JSON_SRC,
  globalName = DEFAULT_GLOBAL_NAME,
  compact = false,
  className,
  style
}: BuildInfoPanelProps): React.ReactElement | null {
  const [info, setInfo] = useState<BuildInfoWithPrint | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      if (typeof window === 'undefined') {
        return
      }

      const globalInfo = (window as unknown as Record<string, BuildInfoWithPrint | undefined>)[globalName]
      if (globalInfo) {
        setInfo(globalInfo)
        return
      }

      try {
        const response = await fetch(src, { cache: 'no-store' })
        if (!response.ok) {
          throw new Error(`Failed to fetch build info: ${response.status}`)
        }
        const nextInfo = (await response.json()) as BuildInfo
        if (!cancelled) {
          setInfo(nextInfo)
        }
      } catch {
        if (!cancelled) {
          setFailed(true)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [globalName, src])

  const summary = useMemo(() => (info ? formatSummary(info) : ''), [info])

  if (!info || failed) {
    return null
  }

  return (
    <div className={className} style={{ ...styles.root, ...style }}>
      <button
        type="button"
        style={styles.summary}
        aria-expanded={!compact && expanded}
        onClick={() => {
          if (!compact) {
            setExpanded((value) => !value)
          }
        }}
      >
        {summary}
      </button>
      {!compact && expanded ? <Details info={info} /> : null}
    </div>
  )
}

function Details({ info }: { info: BuildInfo }): React.ReactElement {
  return (
    <div style={styles.details}>
      <InfoRow label="App" value={info.app.name} />
      <InfoRow label="Version" value={info.app.version} />
      <InfoRow label="Env" value={info.app.env} />
      <InfoRow label="Branch" value={info.git.branch} />
      <InfoRow label="Tag" value={info.tagVersion || info.git.tag || info.git.nearestTag} />
      <InfoRow label="Commit" value={info.git.commit} />
      <InfoRow label="Build time" value={info.build.time} />
      <InfoRow label="Build user" value={info.build.user} />
      <InfoRow label="Deploy target" value={info.deploy?.target} />
      <InfoRow label="Deploy URL" value={info.deploy?.url} href={info.deploy?.url} />
      <InfoRow label="Release ID" value={info.deploy?.releaseId} />
      <InfoRow label="CI" value={info.ci?.jobUrl} href={info.ci?.jobUrl} />
      {info.git.latestCommits.length > 0 ? (
        <div style={styles.commits}>
          {info.git.latestCommits.map((commit) => (
            <div key={commit.hash} style={styles.commit}>
              <code style={styles.code}>{commit.shortHash}</code>
              <span style={styles.commitMessage}>{commit.message}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function InfoRow({
  label,
  value,
  href
}: {
  label: string
  value?: string | undefined
  href?: string | undefined
}): React.ReactElement | null {
  if (!value) {
    return null
  }

  return (
    <div style={styles.row}>
      <span style={styles.label}>{label}</span>
      {href ? (
        <a style={styles.link} href={href} target="_blank" rel="noreferrer">
          {value}
        </a>
      ) : (
        <span style={styles.value}>{value}</span>
      )}
    </div>
  )
}

function formatSummary(info: BuildInfo): string {
  const version = info.app.version ? `v${info.app.version}` : ''
  const commit = info.git.shortCommit || ''
  const time = formatLocalMinute(info.build.time)
  return [info.app.name, version, commit, time].filter(Boolean).join(' · ')
}

const styles = {
  root: {
    color: '#1f2937',
    display: 'inline-flex',
    flexDirection: 'column',
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 12,
    lineHeight: 1.5,
    maxWidth: 'min(560px, 100%)',
    position: 'relative'
  },
  summary: {
    alignItems: 'center',
    background: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    color: '#1f2937',
    cursor: 'pointer',
    display: 'inline-flex',
    font: 'inherit',
    gap: 6,
    minHeight: 30,
    padding: '5px 9px',
    textAlign: 'left'
  },
  details: {
    background: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.12)',
    marginTop: 6,
    minWidth: 320,
    padding: 12
  },
  row: {
    display: 'grid',
    gap: 10,
    gridTemplateColumns: '92px minmax(0, 1fr)',
    padding: '3px 0'
  },
  label: {
    color: '#6b7280'
  },
  value: {
    color: '#111827',
    overflowWrap: 'anywhere'
  },
  link: {
    color: '#2563eb',
    overflowWrap: 'anywhere',
    textDecoration: 'none'
  },
  commits: {
    borderTop: '1px solid #e5e7eb',
    marginTop: 8,
    paddingTop: 8
  },
  commit: {
    alignItems: 'baseline',
    display: 'grid',
    gap: 8,
    gridTemplateColumns: '64px minmax(0, 1fr)',
    padding: '2px 0'
  },
  code: {
    color: '#374151',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 11
  },
  commitMessage: {
    color: '#111827',
    overflowWrap: 'anywhere'
  }
} satisfies Record<string, React.CSSProperties>
