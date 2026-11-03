import {
  listRepositoryEntries,
  readRepositoryFile,
} from '../repositoryFiles.js'

export async function detectDrupalModuleInfoFile(
  cwd: string,
): Promise<string | undefined> {
  const entries = await listRepositoryEntries(cwd)
  const infoFiles = entries.filter((entry) => entry.endsWith('.info.yml'))

  for (const infoFile of infoFiles) {
    const contents = await readRepositoryFile(cwd, infoFile)
    if (/^type:\s*module\s*$/m.test(contents)) {
      return infoFile
    }
  }

  return undefined
}
