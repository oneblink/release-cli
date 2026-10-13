import { readdir, readFile } from 'fs/promises'
import path from 'path'

export async function detectDrupalModuleInfoFile(
  cwd: string,
): Promise<string | undefined> {
  const entries = await readdir(cwd)
  const infoFiles = entries.filter((entry) => entry.endsWith('.info.yml'))

  for (const infoFile of infoFiles) {
    const contents = await readFile(path.join(cwd, infoFile), 'utf-8')
    if (/^type:\s*module\s*$/m.test(contents)) {
      return infoFile
    }
  }

  return undefined
}
