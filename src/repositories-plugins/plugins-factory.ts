import fs from 'fs/promises'
import path from 'path'
import { RepositoryPlugin } from './RepositoryPlugin.js'
import NpmPlugin from './NpmPlugin.js'
import NugetPlugin from './NugetPlugin.js'
import NodeJsPlugin from './NodeJsPlugin.js'
import CdnHostingPlugin from './CdnHostingPlugin.js'

export type RepositoryType =
  | {
      type: 'NPM' | 'NODE_JS' | 'CDN_HOSTING'
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

export default async function getRepositoryPlugin({
  cwd,
  repositoryType,
}: {
  cwd: string
  repositoryType?: RepositoryType
}): Promise<RepositoryPlugin> {
  switch (repositoryType?.type) {
    case 'CDN_HOSTING': {
      return new CdnHostingPlugin({
        cwd,
      })
    }
    case 'NODE_JS': {
      return new NodeJsPlugin({
        cwd,
      })
    }
    case 'NPM': {
      return new NpmPlugin({
        cwd,
      })
    }
    case 'NUGET': {
      return new NugetPlugin({
        cwd,
        relativeProjectFile: repositoryType.relativeProjectFile,
      })
    }
  }

  // If we can't work it out based on type, we will check for certain files.

  if (await exists(path.join(cwd, 'package.json'))) {
    return new NpmPlugin({
      cwd,
    })
  }

  const dotnetSdkProjectFile = path.join('OneBlink.SDK', 'OneBlink.SDK.csproj')
  if (await exists(path.join(cwd, dotnetSdkProjectFile))) {
    return new NugetPlugin({
      cwd,
      relativeProjectFile: dotnetSdkProjectFile,
    })
  }

  throw new Error(`Could not determine the type of repository: ${cwd}`)
}
