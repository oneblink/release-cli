#!/usr/bin/env node

import path from 'path'

import updateNotifier from 'update-notifier'
import meow from 'meow'
import chalk from 'chalk'

import startRepositoryRelease from './commands/startRepositoryRelease.js'
import semver from 'semver'
import promptForNextVersion from './terminal/promptForNextVersion.js'
import getPreRelease from './utils/getPreRelease.js'
import startProductRelease from './commands/startProductRelease.js'
import promptForReleaseName from './terminal/promptForReleaseName.js'
import getRepositoryPlugin from './repositories-plugins/plugins-factory.js'
import startUpdateDependents from './commands/startUpdateDependents.js'
import startChangelogPreview from './commands/startChangelogPreview.js'

const cli = meow(
  `
${chalk.bold.blue('oneblink-release product [--name]')}

${chalk.grey(
  `Release each repository in the Product. Each repository will offer prompts for
the information required to perform the release.`,
)}

  --name ......... Skip the question to enter a name for the release by passing
                   a release name as a flag.

${chalk.bold('Examples')}

  oneblink-release product
  oneblink-release product --name="Inappropriate Release Name"

${chalk.bold.blue(
  'oneblink-release repository [next-version] [--no-git] [--name] [--no-name] [--cwd path]',
)}

${chalk.grey('Release a single repository.')}

  next-version ..... The next version, will prompt for this if not supplied,
                     must be a valid semver number.

    --no-git ....... Skip committing changes and creating an annotated git tag.

    --increment .... Increment the version automatically using "major" | "minor" | "patch".

    --name ......... Skip the question to enter a name for the release by passing
                     a release name as a flag.

    --no-name ...... Skip the question to enter a name for the release. Use
                     option when running a release for an open source repository.

    --cwd .......... Directory of the repository to release relative to the
                     current working directory, defaults to the current
                     working directory.

${chalk.bold('Examples')}

  oneblink-release repository
  oneblink-release repository --no-name
  oneblink-release repository --name="Inappropriate Release Name"
  oneblink-release repository --increment="major"
  oneblink-release repository --increment="minor"
  oneblink-release repository --increment="patch"
  oneblink-release repository 1.1.1
  oneblink-release repository 1.1.1 --cwd ../path/to/code
  oneblink-release repository 1.1.1-uat.1 --no-git

${chalk.grey('Update all product code bases that depend on an NPM package.')}

  --cwd .......... Directory of the repository that is the dependency relative
                   to the current working directory, defaults to the current
                   working directory.

${chalk.bold('Examples')}

  oneblink-release update-dependents
  oneblink-release update-dependents --cwd ../path/to/code
`,
  {
    importMeta: import.meta,
    flags: {
      help: {
        type: 'boolean',
        default: false,
        shortFlag: 'h',
      },
      version: {
        type: 'boolean',
        default: false,
        shortFlag: 'v',
      },
      git: {
        type: 'boolean',
        default: true,
      },
      name: {
        type: 'string',
      },
      increment: {
        type: 'string',
        choices: ['major', 'minor', 'patch'],
      },
      cwd: {
        type: 'string',
        default: process.cwd(),
      },
    },
  },
)

async function getReleaseName({
  name,
  preRelease,
}: {
  name: unknown
  preRelease: string | undefined
}) {
  if (preRelease) {
    return
  }
  if (typeof name === 'string' && name) {
    return name
  }
  if (typeof name === 'boolean' && !name) {
    return undefined
  }

  return await promptForReleaseName()
}

updateNotifier({
  // @ts-expect-error difference in types between packages
  pkg: cli.pkg,
}).notify()

run().catch((error) => {
  process.exitCode = 1
  console.error(error)
})

async function run(): Promise<void> {
  const command = cli.input[0]

  const cwd = path.resolve(process.cwd(), cli.flags.cwd)
  switch (command) {
    case 'changelog-preview': {
      await startChangelogPreview({
        cwd,
      })
      break
    }
    case 'update-dependents': {
      await startUpdateDependents({
        cwd,
      })
      break
    }
    case 'product': {
      const releaseName = cli.flags.name || (await promptForReleaseName())
      await startProductRelease({ releaseName })
      break
    }
    case 'repository': {
      let input = cli.input[1]
      const repositoryPlugin = await getRepositoryPlugin({
        cwd,
      })
      if (cli.flags.increment) {
        const currentVersion = await repositoryPlugin.getCurrentVersion()
        const currentSemverVersion = semver.parse(currentVersion)
        const nextSemverVersion = currentSemverVersion?.inc(
          cli.flags.increment as semver.ReleaseType,
        )
        if (nextSemverVersion) {
          input = nextSemverVersion.version
        }
      }

      if (!semver.valid(input)) {
        const { nextVersion } = await promptForNextVersion({
          repositoryPlugin,
          noPreRelease: false,
        })
        input = nextVersion
      }

      const preRelease = getPreRelease(input)?.tag
      const releaseName = await getReleaseName({
        name: cli.flags.name,
        preRelease,
      })

      await startRepositoryRelease({
        nextVersion: input,
        git: cli.flags.git,
        releaseName,
        repositoryPlugin,
      })
      break
    }
    case undefined: {
      cli.showHelp()
      break
    }
    default: {
      throw new Error(
        `"${command}" is not a valid command. Please use the "--help" flag to view available commands.`,
      )
    }
  }
}
