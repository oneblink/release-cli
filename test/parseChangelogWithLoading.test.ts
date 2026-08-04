import path from 'path'
import { mkdtemp, writeFile, rm } from 'fs/promises'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import parseChangelogWithLoading from '../src/parseChangelogWithLoading.js'

describe('parseChangelogWithLoading', () => {
  it('parses changelogs that use LF line endings', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'changelog-lf-'))
    try {
      await writeFile(
        path.join(cwd, 'CHANGELOG.md'),
        [
          '# Changelog',
          '',
          '## [Unreleased]',
          '',
          '### Added',
          '',
          '- something',
          '',
          '## [1.0.0] - 2026-01-01',
          '',
          '### Added',
          '',
          '- initial release',
          '',
        ].join('\n'),
        'utf-8',
      )

      const { parsedChangelog } = await parseChangelogWithLoading(cwd)

      expect(parsedChangelog.title).toBe('Changelog')
      expect(parsedChangelog.versions[0]?.title).toContain('Unreleased')
      expect(parsedChangelog.versions[1]?.version).toBe('1.0.0')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('parses changelogs that use CRLF line endings', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'changelog-crlf-'))
    try {
      await writeFile(
        path.join(cwd, 'CHANGELOG.md'),
        [
          '# Changelog',
          '',
          '## [Unreleased]',
          '',
          '### Added',
          '',
          '- something',
          '',
          '## [1.0.0] - 2026-01-01',
          '',
          '### Added',
          '',
          '- initial release',
          '',
        ].join('\r\n'),
        'utf-8',
      )

      const { parsedChangelog } = await parseChangelogWithLoading(cwd)

      expect(parsedChangelog.title).toBe('Changelog')
      expect(parsedChangelog.versions[0]?.title).toContain('Unreleased')
      expect(parsedChangelog.versions[1]?.version).toBe('1.0.0')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
})
