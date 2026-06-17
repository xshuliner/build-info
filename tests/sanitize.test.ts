import { describe, expect, it } from 'vitest'
import { sanitizeRemoteUrl } from '../src/utils/sanitize'

describe('sanitizeRemoteUrl', () => {
  it('converts scp-like GitHub remotes to public HTTPS URLs', () => {
    expect(sanitizeRemoteUrl('git@github.com:foo/bar.git')).toBe('https://github.com/foo/bar')
  })

  it('removes HTTPS token credentials', () => {
    expect(sanitizeRemoteUrl('https://token@github.com/foo/bar.git')).toBe('https://github.com/foo/bar')
  })

  it('removes username and password credentials', () => {
    expect(sanitizeRemoteUrl('https://username:password@gitlab.com/foo/bar.git')).toBe(
      'https://gitlab.com/foo/bar'
    )
  })

  it('keeps public HTTPS remotes readable', () => {
    expect(sanitizeRemoteUrl('https://github.com/foo/bar.git')).toBe('https://github.com/foo/bar')
  })
})
