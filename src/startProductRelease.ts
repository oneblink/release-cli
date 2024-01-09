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
import ora from 'ora'
import wrapWithLoading from './wrapWithLoading.js'
import { readPackageUp } from 'read-package-up'
import startReleaseProcess from './startRepositoryRelease.js'

const gitCloneCodeBases: Array<{
  codeBaseName: string
  type: 'NPM' | 'NODE_JS' | 'NUGET'
}> = [
  {
    codeBaseName: 'apps',
    type: 'NPM',
  },
  {
    codeBaseName: 'apps-react',
    type: 'NPM',
  },
  {
    codeBaseName: 'cli',
    type: 'NPM',
  },
  {
    codeBaseName: 'forms-cdn',
    type: 'NODE_JS',
  },
  {
    codeBaseName: 'product-api',
    type: 'NODE_JS',
  },
  {
    codeBaseName: 'product-approvals-api',
    type: 'NODE_JS',
  },
  {
    codeBaseName: 'product-approvals-client',
    type: 'NODE_JS',
  },
  {
    codeBaseName: 'product-cognito-hosted-login-css',
    type: 'NODE_JS',
  },
  {
    codeBaseName: 'product-console',
    type: 'NODE_JS',
  },
  {
    codeBaseName: 'product-form-store-client',
    type: 'NODE_JS',
  },
  {
    codeBaseName: 'product-forms-lambda-at-edge-authorisation',
    type: 'NODE_JS',
  },
  {
    codeBaseName: 'product-forms-renderer',
    type: 'NODE_JS',
  },
  {
    codeBaseName: 'product-infrastructure',
    type: 'NODE_JS',
  },
  {
    codeBaseName: 'product-pdf',
    type: 'NODE_JS',
  },
  {
    codeBaseName: 'product-s3-submission-events',
    type: 'NODE_JS',
  },
  {
    codeBaseName: 'product-volunteers-client',
    type: 'NODE_JS',
  },
  {
    codeBaseName: 'sdk-core-js',
    type: 'NPM',
  },
  {
    codeBaseName: 'sdk-dotnet',
    type: 'NUGET',
  },
  {
    codeBaseName: 'sdk-node-js',
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
  for (const { codeBaseName, type } of gitCloneCodeBases) {
    const codeBaseWorkingDirectory = await wrapWithLoading(
      {
        startText: `Creating temporary directory to clone "${codeBaseName}"`,
        failText: `Failed to create temporary directory to clone "${codeBaseName}"`,
      },
      async (spinner) => {
        const directory = await mkdtemp(join(tmpdir(), codeBaseName))
        spinner.succeed(
          `Created temporary directory to clone "${codeBaseName}"`,
        )
        return directory
      },
    )

    try {
      const cloneUrl = `git@github.com:oneblink/${codeBaseName}.git`
      await executeCommand(
        'git',
        ['clone', cloneUrl, codeBaseWorkingDirectory],
        '.',
      )

      // Check if code base needs releasing
      const { parsedChangelog } = await parseChangelogWithLoading(
        codeBaseWorkingDirectory,
      )
      const unreleasedVersion = parsedChangelog.versions.find((version) =>
        version.title.toLowerCase().includes('unreleased'),
      )
      if (!unreleasedVersion) {
        await continuePromptWithWarning(`"${codeBaseName}" CHANGELOG.md does not contain an "Unreleased" section

You need to checkout "${cloneUrl}" to fix this before trying again.`)
        continue
      }

      const unreleasedChangelogEntries = unreleasedVersion.body.trim()
      if (!unreleasedChangelogEntries) {
        ora(
          `Skipping "${codeBaseName}" as CHANGELOG.md does not contain any entries in the "Unreleased" section.`,
        )
          .start()
          .info()
        continue
      }

      console.log(
        boxen(chalk.blue(unreleasedChangelogEntries), {
          padding: 1,
        }),
      )

      const { isReleasing } = await enquirer.prompt<{
        isReleasing: 'yes' | 'no'
      }>({
        type: 'select',
        name: 'isReleasing',
        message: `Would you like to release "${codeBaseName}"? See unreleased section from changelog above to decide.`,
        choices: [
          {
            message: `No! "${codeBaseName}" does not need to be released.`,
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

      switch (type) {
        case 'NODE_JS': {
          await executeCommand('npm', ['install'], codeBaseWorkingDirectory)

          // NodeJS code bases that are not being published to NPM
          // don't need to follow semantic versioning as no user ever
          // gets the option to choose a version. We will simply increment
          // the existing version by a minor version.
          const result = await readPackageUp({
            cwd: codeBaseWorkingDirectory,
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
              cwd: codeBaseWorkingDirectory,
            })
            nextVersion = promptResult.nextVersion
          }

          await startReleaseProcess({
            nextVersion,
            preRelease: undefined,
            git: true,
            releaseName,
            cwd: codeBaseWorkingDirectory,
          })
          deploymentRequiredUrls.push(
            `https://github.com/oneblink/${codeBaseName}/actions`,
          )
          break
        }
        case 'NPM': {
          await executeCommand('npm', ['install'], codeBaseWorkingDirectory)
          const { nextVersion } = await promptForNextVersion({
            cwd: codeBaseWorkingDirectory,
          })
          await startReleaseProcess({
            nextVersion,
            preRelease: undefined,
            git: true,
            releaseName: undefined,
            cwd: codeBaseWorkingDirectory,
          })
          break
        }
        default: {
          await continuePromptWithWarning(`"${type}" release type has not been catered for.

You need to checkout "${cloneUrl}" and run the release process manually.`)
          continue
        }
      }
    } finally {
      await wrapWithLoading(
        {
          startText: `Removing temporary directory for "${codeBaseName}"`,
          failText: `Failed to remove temporary directory for "${codeBaseName}"`,
        },
        async (spinner) => {
          await rm(codeBaseWorkingDirectory, {
            recursive: true,
            force: true,
          })
          spinner.succeed(`Removed temporary directory for "${codeBaseName}"`)
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
