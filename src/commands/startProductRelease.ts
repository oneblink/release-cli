import enquirer from 'enquirer'
import executeCommand from '../terminal/executeCommand.js'
import promptForNextVersion from '../terminal/promptForNextVersion.js'
import boxen from 'boxen'
import chalk from 'chalk'
import startRepositoryRelease from './startRepositoryRelease.js'
import getRepositoryPlugin from '../repositories-plugins/plugins-factory.js'
import enumerateProductRepositories from '../repositories/enumerateProductRepositories.js'
import generateNextReleaseChangelogEntries from '../changelog/generateNextReleaseChangelogEntries.js'

export default async function startProductRelease({
  releaseName,
}: {
  releaseName: string
}) {
  console.log('Beginning Product release process for:', releaseName)

  const deploymentRequiredUrls: string[] = []
  await enumerateProductRepositories(
    async ({ productRepository, repositoryWorkingDirectory }) => {
      const { repositoryName } = productRepository

      const { stdout: lastCommitMessage } = await executeCommand(
        'git',
        ['log', '-1', '--pretty=oneline'],
        repositoryWorkingDirectory,
      )

      const repositoryPlugin = await getRepositoryPlugin({
        cwd: repositoryWorkingDirectory,
        repositoryType: productRepository,
      })

      const { nextReleaseChangelogEntries } =
        await generateNextReleaseChangelogEntries({
          repositoryPlugin,
        })
      const unreleasedChangelogEntries =
        nextReleaseChangelogEntries.trim() ||
        chalk.italic('There will be no entries under the "Unreleased" heading.')
      console.log(
        boxen(
          chalk.blue(`${unreleasedChangelogEntries}
          
Last Commit: ${lastCommitMessage}`),
          {
            title: 'Unreleased Entries',
            padding: 1,
            margin: {
              top: 1,
              bottom: 1,
            },
          },
        ),
      )

      const { isReleasing } = await enquirer.prompt<{
        isReleasing: 'yes' | 'no'
      }>({
        type: 'select',
        name: 'isReleasing',
        message: `Would you like to release "${repositoryName}"? See unreleased section from changelog above to decide.`,
        choices: [
          {
            message: `No! "${repositoryName}" does not need to be released.`,
            name: 'no',
          },
          {
            message: 'Yes, release away!',
            name: 'yes',
          },
        ],
      })
      if (isReleasing === 'no') {
        return
      }

      const { nextVersion } = await promptForNextVersion({
        repositoryPlugin,
        noPreRelease: true,
      })

      await startRepositoryRelease({
        nextVersion,
        git: true,
        releaseName: productRepository.isPublic ? undefined : releaseName,
        repositoryPlugin,
      })

      if (repositoryPlugin.isDeploymentRequired) {
        deploymentRequiredUrls.push(
          `https://github.com/oneblink/${repositoryName}/actions`,
        )
      }
    },
  )

  console.log(
    boxen(chalk.green('Product Release Complete!!!'), {
      padding: 1,
    }),
  )

  if (deploymentRequiredUrls.length) {
    console.log(
      boxen(
        `The following repositories need to be deployed when ready:

  ${deploymentRequiredUrls.join(`
  `)}`,
        {
          padding: 1,
        },
      ),
    )
  }
}
