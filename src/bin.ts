#!/usr/bin/env node

import path from 'path'

import updateNotifier from 'update-notifier'
import meow from 'meow'
import enquirer from 'enquirer'

import startReleaseProcess from './startReleaseProcess'

const cli = meow(
  `
oneblink-release [next-version] [--no-git] [--name] [--no-name] [--cwd path]

  next-version ..... The next version, will prompt for this if not supplied,
                     must be a valid semver number.

    --no-git ....... Skip committing changes and creating an annotated git tag.

    --name ......... Skip the question to enter a name for the release by passing
                     a release name as a flag.

    --no-name ...... Skip the question to enter a name for the release. Use
                     option when running a release for an open source repository.

    --cwd .......... Directory of the code base to release relative to the
                     current working directory, defaults to the current
                     working directory.

Examples

  oneblink-release
  oneblink-release --no-name
  oneblink-release --name="Inappropriate Release Name"
  oneblink-release 1.1.1
  oneblink-release 1.1.1 --cwd ../path/to/code
  oneblink-release 1.1.1-uat.1 --no-git
`,
  {
    flags: {
      help: {
        type: 'boolean',
        default: false,
        alias: 'h',
      },
      version: {
        type: 'boolean',
        default: false,
        alias: 'v',
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
  }
)

async function getReleaseName(name: unknown) {
  if (typeof name === 'string' && name) {
    return name
  }
  if (typeof name === 'boolean' && !name) {
    return undefined
  }

  const { releaseName } = await enquirer.prompt<{
    releaseName: string
  }>([
    {
      type: 'input',
      message: 'Release name? i.e. JIRA release',
      name: 'releaseName',
    },
  ])
  return releaseName
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
  let input = cli.input[0]
  if (!input) {
    const { nextVersion } = await enquirer.prompt<{ nextVersion: string }>([
      {
        type: 'input',
        message: 'Next version? e.g. "1.2.3" or "1.2.3-beta.1"',
        name: 'nextVersion',
      },
    ])
    input = nextVersion
  }

  const releaseName = await getReleaseName(cli.flags.name)

  await startReleaseProcess({
    nextVersion: input,
    git: cli.flags.git,
    releaseName,
    cwd: path.resolve(process.cwd(), cli.flags.cwd),
  })
}
