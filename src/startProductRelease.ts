import { mkdtemp, rm } from 'fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import enquirer from 'enquirer'
import executeCommand from './executeCommand.js'
import parseChangelogWithLoading from './parseChangelogWithLoading.js'
import promptForNextVersion from './promptForNextVersion.js'
import boxen from 'boxen'
import chalk from 'chalk'
import wrapWithLoading from './wrapWithLoading.js'
import startRepositoryRelease from './startRepositoryRelease.js'
import path from 'path'
import getRepositoryPlugin, {
  RepositoryType,
} from './repositories-plugins/plugins-factory.js'

const gitCloneRepositories: Array<
  {
    repositoryName: string
    isPublic: boolean
  } & RepositoryType
> = [
  {
    repositoryName: 'apps',
    type: 'NPM',
    isPublic: true,
  },
  {
    repositoryName: 'apps-react',
    type: 'NPM',
    isPublic: true,
  },
  {
    repositoryName: 'cli',
    isPublic: true,
    type: 'NPM',
  },
  {
    repositoryName: 'forms-cdn',
    isPublic: true,
    type: 'CDN_HOSTING',
  },
  {
    repositoryName: 'product-api',
    isPublic: false,
    type: 'NODE_JS',
  },
  {
    repositoryName: 'product-approvals-api',
    isPublic: false,
    type: 'NODE_JS',
  },
  {
    repositoryName: 'product-approvals-client',
    isPublic: false,
    type: 'NODE_JS',
  },
  {
    repositoryName: 'product-cognito-hosted-login-css',
    isPublic: false,
    type: 'NODE_JS',
  },
  {
    repositoryName: 'product-console',
    isPublic: false,
    type: 'NODE_JS',
  },
  {
    repositoryName: 'product-form-store-client',
    isPublic: false,
    type: 'NODE_JS',
  },
  {
    repositoryName: 'product-forms-lambda-at-edge-authorisation',
    isPublic: false,
    type: 'NODE_JS',
  },
  {
    repositoryName: 'product-forms-renderer',
    isPublic: false,
    type: 'NODE_JS',
  },
  {
    repositoryName: 'product-infrastructure',
    isPublic: false,
    type: 'NODE_JS',
  },
  {
    repositoryName: 'product-pdf',
    isPublic: false,
    type: 'NODE_JS',
  },
  {
    repositoryName: 'product-s3-submission-events',
    isPublic: false,
    type: 'NODE_JS',
  },
  {
    repositoryName: 'product-volunteers-client',
    isPublic: false,
    type: 'NODE_JS',
  },
  {
    repositoryName: 'sdk-core-js',
    isPublic: true,
    type: 'NPM',
  },
  {
    repositoryName: 'sdk-dotnet',
    isPublic: true,
    type: 'NUGET',
    relativeProjectFile: path.join('OneBlink.SDK', 'OneBlink.SDK.csproj'),
  },
  {
    repositoryName: 'sdk-node-js',
    isPublic: true,
    type: 'NPM',
  },
]

export default async function startProductRelease({
  releaseName,
}: {
  releaseName: string
}) {
  console.log('Beginning Product release process for:', releaseName)

  const deploymentRequiredUrls: string[] = []
  for (const gitCloneRepository of gitCloneRepositories) {
    const { repositoryName } = gitCloneRepository
    const repositoryWorkingDirectory = await wrapWithLoading(
      {
        startText: `Creating temporary directory to clone "${repositoryName}"`,
        failText: `Failed to create temporary directory to clone "${repositoryName}"`,
      },
      async (spinner) => {
        const directory = await mkdtemp(join(tmpdir(), repositoryName))
        spinner.succeed(
          `Created temporary directory to clone "${repositoryName}"`,
        )
        return directory
      },
    )

    try {
      const cloneUrl = `git@github.com:oneblink/${repositoryName}.git`
      await executeCommand(
        'git',
        ['clone', cloneUrl, repositoryWorkingDirectory],
        '.',
      )

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
        continue
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
        continue
      }

      const repositoryPlugin = await getRepositoryPlugin({
        cwd: repositoryWorkingDirectory,
        repositoryType: gitCloneRepository,
      })

      const { nextVersion } = await promptForNextVersion({
        repositoryPlugin,
        noPreRelease: true,
      })

      await startRepositoryRelease({
        nextVersion,
        git: true,
        releaseName: gitCloneRepository.isPublic ? undefined : releaseName,
        repositoryPlugin,
      })

      if (repositoryPlugin.isDeploymentRequired) {
        deploymentRequiredUrls.push(
          `https://github.com/oneblink/${repositoryName}/actions`,
        )
      }
    } finally {
      await wrapWithLoading(
        {
          startText: `Removing temporary directory for "${repositoryName}"`,
          failText: `Failed to remove temporary directory for "${repositoryName}"`,
        },
        async (spinner) => {
          await rm(repositoryWorkingDirectory, {
            recursive: true,
            force: true,
          })
          spinner.succeed(`Removed temporary directory for "${repositoryName}"`)
        },
      )
    }
  }

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
