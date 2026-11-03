import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import {
  readRepositoryFile,
  RepositoryPathError,
  writeRepositoryFile,
} from '../src/repositoryFiles.js'

describe('repositoryFiles', () => {
  it('reads a file written inside the repository root', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'repository-files-'))
    try {
      await writeRepositoryFile(cwd, 'example.txt', 'hello')

      expect(await readRepositoryFile(cwd, 'example.txt')).toBe('hello')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('refuses paths that leave the repository root', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'repository-files-'))
    try {
      await expect(
        readRepositoryFile(cwd, '../outside.txt'),
      ).rejects.toBeInstanceOf(RepositoryPathError)
      await expect(
        readRepositoryFile(cwd, 'nested/../../outside.txt'),
      ).rejects.toBeInstanceOf(RepositoryPathError)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
})
