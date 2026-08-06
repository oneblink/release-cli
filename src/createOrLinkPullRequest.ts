import { Octokit } from '@octokit/rest'
import chalk from 'chalk'

export function createPullRequestOctokit(): Octokit | undefined {
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

export function getCreatePullRequestUrl(
  repositoryName: string,
  ticket: string,
): string {
  return `https://github.com/oneblink/${repositoryName}/pull/new/${ticket}`
}

export default async function createOrLinkPullRequest({
  octokit,
  repositoryName,
  ticket,
  title,
  body,
}: {
  octokit: Octokit | undefined
  repositoryName: string
  ticket: string
  title: string
  body?: string
}): Promise<{ url: string; created: boolean }> {
  const fallbackUrl = getCreatePullRequestUrl(repositoryName, ticket)

  if (!octokit) {
    return {
      url: fallbackUrl,
      created: false,
    }
  }

  try {
    const { data: repository } = await octokit.rest.repos.get({
      owner: 'oneblink',
      repo: repositoryName,
    })
    const { data } = await octokit.rest.pulls.create({
      owner: 'oneblink',
      repo: repositoryName,
      title,
      head: ticket,
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
        `Failed to create pull request for "${repositoryName}": ${
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
