import enquirer from 'enquirer'
import executeCommand from './executeCommand.js'
import parseChangelogWithLoading from './parseChangelogWithLoading.js'
import promptForNextVersion from './promptForNextVersion.js'
import boxen from 'boxen'
import chalk from 'chalk'
import startRepositoryRelease from './startRepositoryRelease.js'
import getRepositoryPlugin from './repositories-plugins/plugins-factory.js'
import enumerateProductRepositories from './enumerateProductRepositories.js'

export default async function startProductRelease({
  releaseName,
}: {
  releaseName: string
}) {
  console.log('Beginning Product release process for:', releaseName)

  const deploymentRequiredUrls: string[] = []
  await enumerateProductRepositories(
    async ({ productRepository, cloneUrl, repositoryWorkingDirectory }) => {
      const { repositoryName } = productRepository

      // Check if repository needs releasing
      const { parsedChangelog } = await parseChangelogWithLoading(
        repositoryWorkingDirectory,
      )
      const unreleasedVersion = parsedChangelog.versions.find((version) =>
        version.title.toLowerCase().includes('unreleased'),
      )
      if (!unreleasedVersion) {
        await continuePromptWithWarning(`"${repositoryName}" CHANGELOG.md does not contain an "Unreleased" section

You need to checkout "${cloneUrl}" to fix this before trying again.`)
        return
      }

      const { stdout: lastCommitMessage } = await executeCommand(
        'git',
        ['log', '-1', '--pretty=oneline'],
        repositoryWorkingDirectory,
      )
      const unreleasedChangelogEntries =
        unreleasedVersion.body.trim() ||
        chalk.italic('There are no entries under the "Unreleased" heading.')
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

      const repositoryPlugin = await getRepositoryPlugin({
        cwd: repositoryWorkingDirectory,
        repositoryType: productRepository,
      })

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

async function continuePromptWithWarning(warning: string) {
  console.log(
    boxen(chalk.yellow(warning), {
      padding: 1,
    }),
  )
  await enquirer.prompt({
    type: 'invisible',
    name: 'continue',
    message: 'Press ENTER to continue.',
  })
}
