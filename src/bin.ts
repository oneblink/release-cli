#!/usr/bin/env node

import path from 'path'

import updateNotifier from 'update-notifier'
import meow from 'meow'
import chalk from 'chalk'

import startRepositoryRelease from './startRepositoryRelease.js'
import semver from 'semver'
import promptForNextVersion from './promptForNextVersion.js'
import getPreRelease from './getPreRelease.js'
import startProductRelease from './startProductRelease.js'
import promptForReleaseName from './promptForReleaseName.js'
import getRepositoryPlugin from './repositories-plugins/plugins-factory.js'
import startUpdateDependents from './startUpdateDependents.js'
import startAuditFix from './startAuditFix.js'
import waitForNpmPackageVersion from './waitForNpmPackageVersion.js'
import { readPackageUp } from 'read-package-up'

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

${chalk.bold.blue('oneblink-release audit-fix [--force] [--ticket]')}

${chalk.grey(
  `Run "npm audit fix --package-lock-only" across each Product repository. Where
package-lock.json changes, create a shared branch, commit, push, and create pull
requests when GITHUB_OAUTH_TOKEN is set (otherwise print create-PR URLs).`,
)}

  --force ......... Skip the ticket prompt. Requires --ticket.

  --ticket ........ Ticket to use as the branch name and commit prefix
                   (e.g. ON-4323). Will prompt if not supplied.
                   Required with --force.

${chalk.bold('Examples')}

  oneblink-release audit-fix
  oneblink-release audit-fix --ticket ON-4323
  oneblink-release audit-fix --force --ticket ON-4323

${chalk.bold.blue(
  'oneblink-release repository [next-version] [--no-git] [--name] [--no-name] [--cwd path] [--update-dependents] [--force] [--force-update-dependency] [--force-publish-intermediate-dependency] [--ticket]',
)}

${chalk.grey('Release a single repository.')}

  next-version ............................. The next version, will prompt for this if not supplied,
                                             must be a valid semver number.

    --no-git ............................... Skip committing changes and creating an annotated git tag.

    --increment ............................ Increment the version automatically using "major" | "minor" | "patch".

    --name ................................. Skip the question to enter a name for the release by passing
                                             a release name as a flag.

    --no-name .............................. Skip the question to enter a name for the release. Use
                                             option when running a release for an open source repository.

    --cwd .................................. Directory of the repository to release relative to the
                                             current working directory, defaults to the current
                                             working directory.

    --update-dependents .................... After the release is tagged, wait for the NPM package to be
                                             published, then run update-dependents.

    --force ................................ When used with --update-dependents, skip all update-dependents
                                             prompts. Requires --ticket.

    --force-update-dependency .............. When used with --update-dependents, skip prompts confirming
                                             dependency updates.

    --force-publish-intermediate-dependency  When used with --update-dependents, skip prompts confirming
                                             intermediate NPM package releases.

    --ticket ............................... Ticket to associate with update-dependents pull requests
                                             (e.g. ON-4323). Required with --force.

${chalk.bold('Examples')}

  oneblink-release repository
  oneblink-release repository --no-name
  oneblink-release repository --no-name --update-dependents
  oneblink-release repository --no-name --update-dependents --force-update-dependency
  oneblink-release repository --no-name --update-dependents --force --ticket ON-4323
  oneblink-release repository --name="Inappropriate Release Name"
  oneblink-release repository --increment="major"
  oneblink-release repository --increment="minor"
  oneblink-release repository --increment="patch"
  oneblink-release repository 1.1.1
  oneblink-release repository 1.1.1 --cwd ../path/to/code
  oneblink-release repository 1.1.1-uat.1 --no-git

${chalk.bold.blue(
  'oneblink-release update-dependents [--cwd path] [--force] [--force-update-dependency] [--force-publish-intermediate-dependency] [--ticket]',
)}

${chalk.grey(
  `Update all product code bases that depend on an NPM package. Creates pull
requests when GITHUB_OAUTH_TOKEN is set (otherwise print create-PR URLs).`,
)}

  --cwd .................................... Directory of the repository that is the dependency relative
                                             to the current working directory, defaults to the current
                                             working directory.

  --force .................................. Skip all prompts. Requires --ticket.

  --force-update-dependency ................ Skip prompts confirming dependency updates.

  --force-publish-intermediate-dependency .. Skip prompts confirming intermediate NPM package releases.

  --ticket ................................. Ticket to associate with pull requests (e.g. ON-4323).
                                             Required with --force.

${chalk.bold('Examples')}

  oneblink-release update-dependents
  oneblink-release update-dependents --cwd ../path/to/code
  oneblink-release update-dependents --force-update-dependency
  oneblink-release update-dependents --force-publish-intermediate-dependency
  oneblink-release update-dependents --force-update-dependency --force-publish-intermediate-dependency
  oneblink-release update-dependents --force --ticket ON-4323
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
      force: {
        type: 'boolean',
        default: false,
      },
      updateDependents: {
        type: 'boolean',
        default: false,
      },
      forceUpdateDependency: {
        type: 'boolean',
        default: false,
      },
      forcePublishIntermediateDependency: {
        type: 'boolean',
        default: false,
      },
      ticket: {
        type: 'string',
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
    case 'update-dependents': {
      await startUpdateDependents({
        cwd,
        force: cli.flags.force,
        forceUpdateDependency: cli.flags.forceUpdateDependency,
        forcePublishIntermediateDependency:
          cli.flags.forcePublishIntermediateDependency,
        ticket: cli.flags.ticket,
      })
      break
    }
    case 'audit-fix': {
      await startAuditFix({
        ticket: cli.flags.ticket,
        force: cli.flags.force,
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

      if (cli.flags.updateDependents) {
        if (!cli.flags.git) {
          throw new Error(
            'Cannot use "--update-dependents" with "--no-git" because the package will not be published.',
          )
        }
        if (!repositoryPlugin.supportsDependencyUpdates) {
          throw new Error(
            `"${repositoryPlugin.displayType}" repositories do not support updating dependents.`,
          )
        }

        const packageResult = await readPackageUp({
          cwd,
        })
        const packageName = packageResult?.packageJson.name
        if (!packageName) {
          throw new Error(
            `Could not determine the package name for updating dependents in: ${cwd}`,
          )
        }
        if (packageResult.packageJson.private) {
          throw new Error(
            `Cannot use "--update-dependents" for private package "${packageName}" because it is not published to npm.`,
          )
        }

        await waitForNpmPackageVersion({
          packageName,
          version: input,
        })
        await startUpdateDependents({
          cwd,
          force: cli.flags.force,
          forceUpdateDependency: cli.flags.forceUpdateDependency,
          forcePublishIntermediateDependency:
            cli.flags.forcePublishIntermediateDependency,
          ticket: cli.flags.ticket,
        })
      }
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
