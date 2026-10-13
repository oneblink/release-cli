import { mkdtemp, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { detectDrupalModuleInfoFile } from '../src/repositories-plugins/detectDrupalModuleInfoFile.js'

describe('detectDrupalModuleInfoFile', () => {
  it('returns a module .info.yml in the repository root', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'drupal-module-'))
    await writeFile(
      join(cwd, 'example.info.yml'),
      `name: Example
type: module
`,
      'utf-8',
    )

    expect(await detectDrupalModuleInfoFile(cwd)).toBe('example.info.yml')
  })

  it('ignores non-module .info.yml files', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'drupal-theme-'))
    await writeFile(
      join(cwd, 'example.info.yml'),
      `name: Example
type: theme
`,
      'utf-8',
    )

    expect(await detectDrupalModuleInfoFile(cwd)).toBeUndefined()
  })
})
