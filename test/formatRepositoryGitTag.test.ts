import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GIT_TAG_PREFIX,
  formatRepositoryGitTag,
} from '../src/repositories-plugins/RepositoryPlugin.js'

describe('formatRepositoryGitTag', () => {
  it('prefixes tags for npm-style repositories', () => {
    expect(
      formatRepositoryGitTag(DEFAULT_GIT_TAG_PREFIX, '1.2.3'),
    ).toBe('v1.2.3')
  })

  it('uses bare semver for Drupal modules', () => {
    expect(formatRepositoryGitTag('', '1.2.3')).toBe('1.2.3')
  })
})
