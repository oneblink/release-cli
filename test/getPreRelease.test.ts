import { describe, expect, it } from 'vitest'
import getPreRelease from '../src/getPreRelease.js'

describe('getPreRelease', () => {
  it('parses npm-style prerelease identifiers', () => {
    expect(getPreRelease('1.0.0-beta.1')).toEqual({
      tag: 'beta',
      version: 1,
    })
    expect(getPreRelease('2.1.0-rc.3')).toEqual({
      tag: 'rc',
      version: 3,
    })
  })

  it('parses Drupal-style combined prerelease identifiers', () => {
    expect(getPreRelease('1.0.0-beta1')).toEqual({
      tag: 'beta',
      version: 1,
    })
    expect(getPreRelease('1.0.0-alpha2')).toEqual({
      tag: 'alpha',
      version: 2,
    })
    expect(getPreRelease('1.0.0-rc1')).toEqual({
      tag: 'rc',
      version: 1,
    })
  })

  it('returns undefined for stable versions', () => {
    expect(getPreRelease('1.0.0')).toBeUndefined()
  })

  it('returns undefined for unrecognized prerelease shapes', () => {
    expect(getPreRelease('1.0.0-dev')).toBeUndefined()
    expect(getPreRelease('1.0.0-next')).toBeUndefined()
  })
})
