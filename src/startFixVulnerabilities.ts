import boxen from 'boxen'
import chalk from 'chalk'
import enumerateProductRepositories from './enumerateProductRepositories.js'
import executeCommand from './executeCommand.js'
import createOrLinkPullRequest, {
  createPullRequestOctokit,
} from './createOrLinkPullRequest.js'
import resolveTicket from './resolveTicket.js'
import getRepositoryPlugin from './repositories-plugins/plugins-factory.js'

export default async function startFixVulnerabilities({
  ticket: ticketFlag,
  force = false,
}: {
  ticket?: string
  force?: boolean
}) {
  const ticket = await resolveTicket({ ticketFlag, force })
  const octokit = createPullRequestOctokit()

  console.log(
    `Beginning vulnerability fixes across product repositories using branch "${ticket}"`,
  )

  const pullRequestUrls: string[] = []
  const fixedRepositories: string[] = []
  let createdAnyPullRequest = false
  let completedSuccessfully = false

  try {
    await enumerateProductRepositories(
      async ({ productRepository, repositoryWorkingDirectory }) => {
        const { repositoryName } = productRepository

        const repositoryPlugin = await getRepositoryPlugin({
          cwd: repositoryWorkingDirectory,
          repositoryType: productRepository,
        })

        if (!repositoryPlugin.fixVulnerabilities) {
          console.log(
            `Skipping "${repositoryName}" as "${repositoryPlugin.displayType}" does not support fixing vulnerabilities.`,
          )
          return
        }

        const fixResult = await repositoryPlugin.fixVulnerabilities({
          ticket,
          repositoryName,
        })

        if (!fixResult) {
          return
        }

        const { filesToStage, commitMessage, pullRequestBody } = fixResult

        await executeCommand(
          'git',
          ['checkout', '-b', ticket],
          repositoryWorkingDirectory,
        )
        await executeCommand(
          'git',
          ['add', ...filesToStage],
          repositoryWorkingDirectory,
        )
        await executeCommand(
          'git',
          ['commit', '--message', commitMessage],
          repositoryWorkingDirectory,
        )
        await executeCommand(
          'git',
          ['push', '-u', 'origin', ticket],
          repositoryWorkingDirectory,
        )

        const pullRequest = await createOrLinkPullRequest({
          octokit,
          repositoryName,
          ticket,
          title: commitMessage,
          body: pullRequestBody,
        })

        fixedRepositories.push(repositoryName)
        pullRequestUrls.push(pullRequest.url)
        if (pullRequest.created) {
          createdAnyPullRequest = true
        }
      },
    )

    completedSuccessfully = true
  } finally {
    console.log(
      boxen(
        chalk[completedSuccessfully ? 'green' : 'yellow'](
          completedSuccessfully
            ? 'fix vulnerabilities complete!!!'
            : 'fix vulnerabilities stopped after an error',
        ),
        {
          padding: 1,
        },
      ),
    )

    if (fixedRepositories.length) {
      console.log(
        boxen(
          `The following repositories had fixes applied:

  ${fixedRepositories.join(`
  `)}`,
          {
            padding: 1,
          },
        ),
      )
    }

    if (pullRequestUrls.length) {
      const pullRequestHeading = createdAnyPullRequest
        ? 'The following Pull Requests were created:'
        : 'The following Pull Requests can be created:'
      console.log(
        boxen(
          `${pullRequestHeading}

  ${pullRequestUrls.join(`
  `)}`,
          {
            padding: 1,
          },
        ),
      )
    } else if (completedSuccessfully) {
      console.log(
        boxen(chalk.blue('No vulnerability fixes were produced.'), {
          padding: 1,
        }),
      )
    }
  }
}
