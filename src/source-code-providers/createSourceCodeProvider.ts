import { execa } from 'execa'
import DrupalGitSourceCodeProvider from './DrupalGitSourceCodeProvider.js'
import GitHubSourceCodeProvider from './GitHubSourceCodeProvider.js'
import GitLabSourceCodeProvider from './GitLabSourceCodeProvider.js'
import { SourceCodeProvider } from './SourceCodeProvider.js'
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

function createSourceCodeProviderFromGitRemote(
  remote: string,
): SourceCodeProvider | undefined {
  const githubSsh = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i
  const githubHttps = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i
  const drupalSsh = /^git@git\.drupal\.org:project\/([^/]+?)(?:\.git)?$/i
  const gitlabSsh = /^git@([^:]+):(.+?)(?:\.git)?$/i
  const gitlabHttps = /^https:\/\/([^/]+)\/(.+?)(?:\.git)?\/?$/i

  let match = remote.match(githubSsh)
  if (match) {
    return new GitHubSourceCodeProvider({
      owner: match[1],
      repositoryName: match[2],
    })
  }

  match = remote.match(githubHttps)
  if (match) {
    return new GitHubSourceCodeProvider({
      owner: match[1],
      repositoryName: match[2],
    })
  }

  match = remote.match(drupalSsh)
  if (match) {
    return new DrupalGitSourceCodeProvider({
      projectName: match[1],
    })
  }

  match = remote.match(gitlabSsh)
  if (match && isGitLabHost(match[1])) {
    return new GitLabSourceCodeProvider({
      host: match[1],
      projectPath: match[2],
    })
  }

  match = remote.match(gitlabHttps)
  if (match && isGitLabHost(match[1])) {
    return new GitLabSourceCodeProvider({
      host: match[1],
      projectPath: match[2],
    })
  }

  return undefined
}

function isGitLabHost(host: string): boolean {
  const normalized = host.toLowerCase()
  return (
    normalized === 'gitlab.com' ||
    normalized.endsWith('.gitlab.com') ||
    normalized.includes('gitlab')
  )
}

export async function createSourceCodeProviderFromWorkingDirectory(
  cwd: string,
): Promise<SourceCodeProvider> {
  try {
    const { stdout } = await execa('git', ['remote', 'get-url', 'origin'], {
      cwd,
    })
    const remote = stdout.trim()
    const provider = createSourceCodeProviderFromGitRemote(remote)
    if (provider) {
      return provider
    }
    return new UnconfiguredSourceCodeProvider({ cloneUrl: remote })
  } catch {
    return new UnconfiguredSourceCodeProvider({ cloneUrl: cwd })
  }
}
