import { mkdtemp, rm } from 'fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import enquirer from 'enquirer'
import semver from 'semver'
import executeCommand from './executeCommand.js'
import parseChangelogWithLoading from './parseChangelogWithLoading.js'
import promptForNextVersion from './promptForNextVersion.js'
import boxen from 'boxen'
import chalk from 'chalk'
import wrapWithLoading from './wrapWithLoading.js'
import { readPackageUp } from 'read-package-up'
import startReleaseProcess from './startRepositoryRelease.js'
import { RepositoryType } from './getRepositoryType.js'
import path from 'path'

const gitCloneRepositories: Array<
  {
    repositoryName: string
  } & RepositoryType
> = [
  {
    repositoryName: 'apps',
    type: 'NPM',
  },
  {
    repositoryName: 'apps-react',
    type: 'NPM',
  },
  {
    repositoryName: 'cli',
    type: 'NPM',
  },
  {
    repositoryName: 'forms-cdn',
    type: 'NODE_JS',
  },
  {
    repositoryName: 'product-api',
    type: 'NODE_JS',
  },
  {
    repositoryName: 'product-approvals-api',
    type: 'NODE_JS',
  },
  {
    repositoryName: 'product-approvals-client',
    type: 'NODE_JS',
  },
  {
    repositoryName: 'product-cognito-hosted-login-css',
    type: 'NODE_JS',
  },
  {
    repositoryName: 'product-console',
    type: 'NODE_JS',
  },
  {
    repositoryName: 'product-form-store-client',
    type: 'NODE_JS',
  },
  {
    repositoryName: 'product-forms-lambda-at-edge-authorisation',
    type: 'NODE_JS',
  },
  {
    repositoryName: 'product-forms-renderer',
    type: 'NODE_JS',
  },
  {
    repositoryName: 'product-infrastructure',
    type: 'NODE_JS',
  },
  {
    repositoryName: 'product-pdf',
    type: 'NODE_JS',
  },
  {
    repositoryName: 'product-s3-submission-events',
    type: 'NODE_JS',
  },
  {
    repositoryName: 'product-volunteers-client',
    type: 'NODE_JS',
  },
  {
    repositoryName: 'sdk-core-js',
    type: 'NPM',
  },
  {
    repositoryName: 'sdk-dotnet',
    type: 'NUGET',
    relativeProjectFile: path.join('OneBlink.SDK', 'OneBlink.SDK.csproj'),
  },
  {
    repositoryName: 'sdk-node-js',
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

      switch (gitCloneRepository.type) {
        case 'NODE_JS': {
          // NodeJS repositories that are not being published to NPM
          // don't need to follow semantic versioning as no user ever
          // gets the option to choose a version. We will simply increment
          // the existing version by a minor version.
          const result = await readPackageUp({
            cwd: repositoryWorkingDirectory,
          })
          const currentVersion = semver.valid(result?.packageJson.version)
          let nextVersion = ''
          if (currentVersion) {
            const nextSemverVersion = semver.inc(currentVersion, 'minor')
            if (nextSemverVersion) {
              nextVersion = nextSemverVersion
            }
          }

          // If we can't find an existing version to
          // increment, we will ask for the next one.
          if (!nextVersion) {
            const promptResult = await promptForNextVersion({
              type: gitCloneRepository,
              cwd: repositoryWorkingDirectory,
            })
            nextVersion = promptResult.nextVersion
          }

          await startReleaseProcess({
            nextVersion,
            preRelease: undefined,
            git: true,
            releaseName,
            cwd: repositoryWorkingDirectory,
            type: gitCloneRepository,
          })
          deploymentRequiredUrls.push(
            `https://github.com/oneblink/${repositoryName}/actions`,
          )
          break
        }
        case 'NUGET':
        case 'NPM': {
          const { nextVersion } = await promptForNextVersion({
            type: gitCloneRepository,
            cwd: repositoryWorkingDirectory,
          })
          await startReleaseProcess({
            nextVersion,
            preRelease: undefined,
            git: true,
            releaseName: undefined,
            cwd: repositoryWorkingDirectory,
            type: gitCloneRepository,
          })
          break
        }
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
