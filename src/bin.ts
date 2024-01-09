#!/usr/bin/env node

import path from 'path'

import updateNotifier from 'update-notifier'
import meow from 'meow'
import chalk from 'chalk'

import startRepositoryRelease from './startRepositoryRelease.js'
import semver from 'semver'
import promptForNextVersion from './promptForNextVersion.js'
import startProductRelease from './startProductRelease.js'
import promptForReleaseName from './promptForReleaseName.js'

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
  oneblink-release repository 1.1.1
  oneblink-release repository 1.1.1 --cwd ../path/to/code
  oneblink-release repository 1.1.1-uat.1 --no-git
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
  switch (command) {
    case 'product': {
      const releaseName = cli.flags.name || (await promptForReleaseName())
      await startProductRelease({ releaseName })
      break
    }
    case 'repository': {
      let input = cli.input[1]
      const cwd = path.resolve(process.cwd(), cli.flags.cwd)
      if (!semver.valid(input)) {
        const { nextVersion } = await promptForNextVersion({ cwd })
        input = nextVersion
      }

      const preReleaseComponents = semver.prerelease(input)
      const preRelease =
        typeof preReleaseComponents?.[0] === 'string'
          ? preReleaseComponents[0]
          : undefined
      const releaseName = await getReleaseName({
        name: cli.flags.name,
        preRelease,
      })

      await startRepositoryRelease({
        preRelease,
        nextVersion: input,
        git: cli.flags.git,
        releaseName,
        cwd,
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
