import fs from 'fs/promises'
import path from 'path'

export type RepositoryType =
  | {
      type: 'NPM' | 'NODE_JS'
    }
  | {
      type: 'NUGET'
      relativeProjectFile: string
    }

async function exists(filePath: string) {
  try {
    await fs.stat(filePath)
    return true
  } catch {
    return false
  }
}

export default async function getRepositoryType({
  cwd,
}: {
  cwd: string
}): Promise<RepositoryType> {
  if (await exists(path.join(cwd, 'package.json'))) {
    return { type: 'NPM' }
  }

  const dotnetSdkProfileFile = path.join('OneBlink.SDK', 'OneBlink.SDK.csproj')
  if (await exists(path.join(cwd, dotnetSdkProfileFile))) {
    return {
      type: 'NUGET',
      relativeProjectFile: dotnetSdkProfileFile,
    }
  }

  throw new Error(`Could not determine the type of repository: ${cwd}`)
}
