import { beforeEach, describe, expect, it, vi } from 'vitest'

const { execaMock } = vi.hoisted(() => ({
  execaMock: vi.fn(),
}))

vi.mock('execa', () => ({
  execa: execaMock,
}))

import { createSourceCodeProviderFromWorkingDirectory } from '../src/source-code-providers/createSourceCodeProvider.js'
import DrupalGitSourceCodeProvider from '../src/source-code-providers/DrupalGitSourceCodeProvider.js'
import GitHubSourceCodeProvider from '../src/source-code-providers/GitHubSourceCodeProvider.js'
import GitLabSourceCodeProvider from '../src/source-code-providers/GitLabSourceCodeProvider.js'
import UnconfiguredSourceCodeProvider from '../src/source-code-providers/UnconfiguredSourceCodeProvider.js'

const cwd = '/tmp/my-repo'

describe('createSourceCodeProviderFromWorkingDirectory', () => {
  beforeEach(() => {
    execaMock.mockReset()
  })

  it('parses GitHub SSH and HTTPS remotes', async () => {
    execaMock.mockResolvedValueOnce({
      stdout: 'git@github.com:oneblink/release-cli.git',
    })
    const ssh = await createSourceCodeProviderFromWorkingDirectory(cwd)
    expect(ssh).toBeInstanceOf(GitHubSourceCodeProvider)
    expect(ssh.cloneUrl).toBe('git@github.com:oneblink/release-cli.git')

    execaMock.mockResolvedValueOnce({
      stdout: 'https://github.com/oneblink/release-cli.git',
    })
    const https = await createSourceCodeProviderFromWorkingDirectory(cwd)
    expect(https).toBeInstanceOf(GitHubSourceCodeProvider)
    expect(https.cloneUrl).toBe('git@github.com:oneblink/release-cli.git')
  })

  it('parses Drupal Git SSH remotes', async () => {
    execaMock.mockResolvedValueOnce({
      stdout: 'git@git.drupal.org:project/oneblink_form_embed.git',
    })
    const provider = await createSourceCodeProviderFromWorkingDirectory(cwd)
    expect(provider).toBeInstanceOf(DrupalGitSourceCodeProvider)
    expect(provider.cloneUrl).toBe(
      'git@git.drupal.org:project/oneblink_form_embed.git',
    )
  })

  it('parses GitLab SSH remotes', async () => {
    execaMock.mockResolvedValueOnce({
      stdout: 'git@gitlab.com:my-group/my-project.git',
    })
    const provider = await createSourceCodeProviderFromWorkingDirectory(cwd)
    expect(provider).toBeInstanceOf(GitLabSourceCodeProvider)
    expect(provider.cloneUrl).toBe('git@gitlab.com:my-group/my-project.git')
  })

  it('uses GitHub for github.com remotes instead of GitLab', async () => {
    execaMock.mockResolvedValueOnce({
      stdout: 'git@github.com:oneblink/release-cli.git',
    })
    const provider = await createSourceCodeProviderFromWorkingDirectory(cwd)
    expect(provider).toBeInstanceOf(GitHubSourceCodeProvider)
    expect(provider).not.toBeInstanceOf(GitLabSourceCodeProvider)
  })

  it('returns unconfigured provider for unrecognized remotes', async () => {
    execaMock.mockResolvedValueOnce({
      stdout: 'git@example.com:org/repo.git',
    })
    const provider = await createSourceCodeProviderFromWorkingDirectory(cwd)
    expect(provider).toBeInstanceOf(UnconfiguredSourceCodeProvider)
    expect(provider.cloneUrl).toBe('git@example.com:org/repo.git')
  })

  it('returns unconfigured provider when origin is missing', async () => {
    execaMock.mockRejectedValueOnce(new Error('not a git repository'))
    const provider = await createSourceCodeProviderFromWorkingDirectory(cwd)
    expect(provider).toBeInstanceOf(UnconfiguredSourceCodeProvider)
    expect(provider.cloneUrl).toBe(cwd)
  })
})
