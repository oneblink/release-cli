#!/usr/bin/env node

import path from 'path'

import updateNotifier from 'update-notifier'
import meow from 'meow'
import enquirer from 'enquirer'

import startReleaseProcess from './startReleaseProcess.js'

const cli = meow(
  `
oneblink-release [next-version] [--no-git] [--cwd path]

  next-version ..... The next version, will prompt for this if not supplied,
                     must be a valid semver number.

    --no-git ....... Skip committing changes and creating an annotated git tag.

    --cwd .......... Directory of the code base to release relative to the
                     current working directory, defaults to the current
                     working directory.

Examples

  oneblink-release
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
      cwd: {
        type: 'string',
        default: process.cwd(),
      },
    },
  }
)

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

  await startReleaseProcess({
    nextVersion: input,
    git: cli.flags.git,
    cwd: path.resolve(process.cwd(), cli.flags.cwd),
  })
}
