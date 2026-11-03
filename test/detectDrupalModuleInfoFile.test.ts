import { mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { writeRepositoryFile } from '../src/repositoryFiles.js'
import { detectDrupalModuleInfoFile } from '../src/repositories-plugins/detectDrupalModuleInfoFile.js'

describe('detectDrupalModuleInfoFile', () => {
  it('returns a module .info.yml in the repository root', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'drupal-module-'))
    await writeRepositoryFile(
      cwd,
      'example.info.yml',
      `name: Example
type: module
`,
    )

    expect(await detectDrupalModuleInfoFile(cwd)).toBe('example.info.yml')
  })

  it('ignores non-module .info.yml files', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'drupal-theme-'))
    await writeRepositoryFile(
      cwd,
      'example.info.yml',
      `name: Example
type: theme
`,
    )

    expect(await detectDrupalModuleInfoFile(cwd)).toBeUndefined()
  })
})
