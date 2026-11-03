import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { executeCommandMock, reposGetMock, pullsCreateMock, OctokitMock } =
  vi.hoisted(() => {
    const reposGetMock = vi.fn()
    const pullsCreateMock = vi.fn()
    const OctokitMock = vi.fn(
      class Octokit {
        log = { debug: () => undefined }
        rest = {
          repos: { get: reposGetMock },
          pulls: { create: pullsCreateMock },
        }
      },
    )
    return {
      executeCommandMock: vi.fn(),
      reposGetMock,
      pullsCreateMock,
      OctokitMock,
    }
  })

vi.mock('../src/executeCommand.js', () => ({
  default: executeCommandMock,
}))

vi.mock('@octokit/rest', () => ({
  Octokit: OctokitMock,
}))

import GitHubSourceCodeProvider from '../src/source-code-providers/GitHubSourceCodeProvider.js'

describe('GitHubSourceCodeProvider.pushBranchForReview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('GITHUB_OAUTH_TOKEN', 'github_pat_test')
    reposGetMock.mockResolvedValue({
      data: { default_branch: 'main' },
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('creates the pull request from the branch on this repository', async () => {
    pullsCreateMock.mockResolvedValue({
      data: {
        html_url:
          'https://github.com/oneblink/product-approvals-client/pull/12',
      },
    })

    const provider = new GitHubSourceCodeProvider({
      owner: 'oneblink',
      repositoryName: 'product-approvals-client',
    })

    const result = await provider.pushBranchForReview({
      cwd: '/tmp/product-approvals-client',
      branchName: 'ON-4323',
      title: 'ON-4323: fix vulnerabilities',
      body: 'Updated the lockfile.',
    })

    expect(executeCommandMock).toHaveBeenCalledWith(
      'git',
      ['push', '-u', 'origin', 'ON-4323'],
      '/tmp/product-approvals-client',
    )
    expect(pullsCreateMock).toHaveBeenCalledWith({
      owner: 'oneblink',
      repo: 'product-approvals-client',
      title: 'ON-4323: fix vulnerabilities',
      head: 'oneblink:ON-4323',
      head_repo: 'product-approvals-client',
      base: 'main',
      body: 'Updated the lockfile.',
    })
    expect(result).toEqual({
      url: 'https://github.com/oneblink/product-approvals-client/pull/12',
      created: true,
    })
  })

  it('falls back to the create-PR URL when GitHub rejects the request', async () => {
    pullsCreateMock.mockRejectedValue(
      new Error(
        'Validation Failed: {"resource":"PullRequest","code":"custom","message":"not all refs are readable"}',
      ),
    )
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const provider = new GitHubSourceCodeProvider({
      owner: 'oneblink',
      repositoryName: 'product-approvals-client',
    })

    const result = await provider.pushBranchForReview({
      cwd: '/tmp/product-approvals-client',
      branchName: 'ON-4323',
      title: 'ON-4323: fix vulnerabilities',
    })

    expect(result).toEqual({
      url: 'https://github.com/oneblink/product-approvals-client/pull/new/ON-4323',
      created: false,
    })
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('not all refs are readable'),
    )
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Contents: Read'),
    )
    warn.mockRestore()
  })
})
