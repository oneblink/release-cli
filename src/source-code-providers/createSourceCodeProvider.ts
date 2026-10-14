import { execa } from 'execa'
import DrupalGitSourceCodeProvider from './DrupalGitSourceCodeProvider.js'
import GitHubSourceCodeProvider from './GitHubSourceCodeProvider.js'
import GitLabSourceCodeProvider from './GitLabSourceCodeProvider.js'
import {
  SourceCodeProvider,
  SourceCodeProviderGitRemoteParser,
} from './SourceCodeProvider.js'
import UnconfiguredSourceCodeProvider from './UnconfiguredSourceCodeProvider.js'

export type SourceCodeProviderConfig =
  | {
      type: 'GITHUB'
      owner: string
      repositoryName: string
    }
  | {
      type: 'GITLAB'
      host: string
      projectPath: string
    }
  | {
      type: 'DRUPAL_GIT'
      projectName: string
    }

const fromGitRemoteParsers: readonly SourceCodeProviderGitRemoteParser[] = [
  GitHubSourceCodeProvider,
  DrupalGitSourceCodeProvider,
  GitLabSourceCodeProvider,
]

export default function createSourceCodeProvider(
  config: SourceCodeProviderConfig,
): SourceCodeProvider {
  switch (config.type) {
    case 'GITHUB': {
      return new GitHubSourceCodeProvider({
        owner: config.owner,
        repositoryName: config.repositoryName,
      })
    }
    case 'GITLAB': {
      return new GitLabSourceCodeProvider({
        host: config.host,
        projectPath: config.projectPath,
      })
    }
    case 'DRUPAL_GIT': {
      return new DrupalGitSourceCodeProvider({
        projectName: config.projectName,
      })
    }
  }
}

export async function createSourceCodeProviderFromWorkingDirectory(
  cwd: string,
): Promise<SourceCodeProvider> {
  try {
    const { stdout } = await execa('git', ['remote', 'get-url', 'origin'], {
      cwd,
    })
    const remote = stdout.trim()
    for (const parser of fromGitRemoteParsers) {
      const provider = parser.fromGitRemote(remote)
      if (provider) {
        return provider
      }
    }
    return new UnconfiguredSourceCodeProvider({ cloneUrl: remote })
  } catch {
    return new UnconfiguredSourceCodeProvider({ cloneUrl: cwd })
  }
}
