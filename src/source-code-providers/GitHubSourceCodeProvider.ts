import { Octokit } from '@octokit/rest'
import chalk from 'chalk'
import executeCommand from '../executeCommand.js'
import {
  PushBranchForReviewOptions,
  PushBranchForReviewResult,
  SourceCodeProvider,
} from './SourceCodeProvider.js'

function createPullRequestOctokit(): Octokit | undefined {
  const token = process.env.GITHUB_OAUTH_TOKEN
  if (!token) {
    return undefined
  }

  const octokit = new Octokit({
    auth: token,
  })
  octokit.log.debug = () => undefined
  return octokit
}

export default class GitHubSourceCodeProvider extends SourceCodeProvider {
  readonly displayName = 'GitHub'
  readonly cloneUrl: string
  readonly deploymentUrl: string

  readonly owner: string
  readonly repositoryName: string

  constructor({
    owner,
    repositoryName,
  }: {
    owner: string
    repositoryName: string
  }) {
    super()
    this.owner = owner
    this.repositoryName = repositoryName
    const webBase = `https://github.com/${owner}/${repositoryName}`
    this.cloneUrl = `git@github.com:${owner}/${repositoryName}.git`
    this.deploymentUrl = `${webBase}/actions`
  }

  newPullRequestUrl(branchName: string): string {
    return `https://github.com/${this.owner}/${this.repositoryName}/pull/new/${branchName}`
  }

  async pushBranchForReview({
    cwd,
    branchName,
    title,
    body,
  }: PushBranchForReviewOptions): Promise<PushBranchForReviewResult> {
    await executeCommand('git', ['push', '-u', 'origin', branchName], cwd)

    const fallbackUrl = this.newPullRequestUrl(branchName)
    const octokit = createPullRequestOctokit()

    if (!octokit) {
      return {
        url: fallbackUrl,
        created: false,
      }
    }

    try {
      const { data: repository } = await octokit.rest.repos.get({
        owner: this.owner,
        repo: this.repositoryName,
      })
      const { data } = await octokit.rest.pulls.create({
        owner: this.owner,
        repo: this.repositoryName,
        title,
        head: branchName,
        base: repository.default_branch,
        body,
      })

      return {
        url: data.html_url,
        created: true,
      }
    } catch (error) {
      console.warn(
        chalk.yellow(
          `Failed to create pull request for "${this.repositoryName}": ${
            error instanceof Error ? error.message : String(error)
          }. Falling back to create-PR URL.`,
        ),
      )
      return {
        url: fallbackUrl,
        created: false,
      }
    }
  }
}
