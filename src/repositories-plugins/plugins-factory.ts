import fs from 'fs/promises'
import path from 'path'
import { SourceCodeProvider } from '../source-code-providers/SourceCodeProvider.js'
import { RepositoryPlugin } from './RepositoryPlugin.js'
import NpmPlugin from './NpmPlugin.js'
import NugetPlugin from './NugetPlugin.js'
import NodeJsPlugin from './NodeJsPlugin.js'
import CdnHostingPlugin from './CdnHostingPlugin.js'
import DrupalModulePlugin from './DrupalModulePlugin.js'

export type RepositoryType =
  | {
      type: 'NPM' | 'NODE_JS' | 'CDN_HOSTING'
    }
  | {
      type: 'NUGET'
      relativeProjectFile: string
    }
  | {
      type: 'DRUPAL_MODULE'
      relativeInfoFile: string
    }

type RepositoryPluginFactoryOptions = {
  cwd: string
  sourceCodeProvider: SourceCodeProvider
  repositoryType?: RepositoryType
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
  sourceCodeProvider,
}: RepositoryPluginFactoryOptions): Promise<RepositoryPlugin> {
  switch (repositoryType?.type) {
    case 'CDN_HOSTING': {
      return new CdnHostingPlugin({
        cwd,
        sourceCodeProvider,
      })
    }
    case 'NODE_JS': {
      return new NodeJsPlugin({
        cwd,
        sourceCodeProvider,
      })
    }
    case 'NPM': {
      return new NpmPlugin({
        cwd,
        sourceCodeProvider,
      })
    }
    case 'NUGET': {
      return new NugetPlugin({
        cwd,
        relativeProjectFile: repositoryType.relativeProjectFile,
        sourceCodeProvider,
      })
    }
    case 'DRUPAL_MODULE': {
      return new DrupalModulePlugin({
        cwd,
        relativeInfoFile: repositoryType.relativeInfoFile,
        sourceCodeProvider,
      })
    }
  }

  // If we can't work it out based on type, we will check for certain files.

  if (await exists(path.join(cwd, 'package.json'))) {
    return new NpmPlugin({
      cwd,
      sourceCodeProvider,
    })
  }

  const dotnetSdkProjectFile = path.join('OneBlink.SDK', 'OneBlink.SDK.csproj')
  if (await exists(path.join(cwd, dotnetSdkProjectFile))) {
    return new NugetPlugin({
      cwd,
      relativeProjectFile: dotnetSdkProjectFile,
      sourceCodeProvider,
    })
  }

  throw new Error(`Could not determine the type of repository: ${cwd}`)
}
