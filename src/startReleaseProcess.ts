import fs from 'fs'
import path from 'path'
import util from 'util'

import { execa } from 'execa'
import prettier from 'prettier'
import parseChangelog from 'changelog-parser'
import { main as packageDiffSummary } from './package-diff-summary/index.js'
import semver from 'semver'
import ora, { Ora } from 'ora'
import { readPackageUp } from 'read-package-up'

const readFileAsync = util.promisify(fs.readFile)
const writeFileAsync = util.promisify(fs.writeFile)

const UNRELEASED_VERSION_INDEX = 0
const GIT_TAG_PREFIX = 'v'

type ParseChangelogVersion = {
  title: string
  version: string
  body: string
}

type ParsedChangelog = {
  title: string
  description?: string
  versions: ParseChangelogVersion[]
}

async function wrapWithLoading<T>(
  { startText, failText }: { startText: string; failText: string },
  fn: (spinner: Ora) => Promise<T>,
): Promise<T> {
  const spinner = ora(startText).start()
  try {
    const t = await fn(spinner)
    if (spinner.isSpinning) {
      spinner.stop()
    }
    return t
  } catch (error) {
    spinner.fail(failText)
    throw error
  }
}

async function updateChangelog({
  nextSemverVersion,
  cwd,
  releaseName,
}: {
  nextSemverVersion: string
  cwd: string
  releaseName: string | undefined
}) {
  const changelogPath = path.join(cwd, 'CHANGELOG.md')
  const parsedChangelog = await wrapWithLoading(
    {
      startText: `Parsing ${changelogPath}`,
      failText: `Failed to parsed ${changelogPath}`,
    },
    async (spinner) => {
      const parsedChangelog = (await parseChangelog(
        changelogPath,
      )) as ParsedChangelog
      spinner.succeed(`Parsed ${changelogPath}`)
      return parsedChangelog
    },
  )

  const dependenciesChangelogEntry = await wrapWithLoading(
    {
      startText:
        'Checking if the "Dependencies" heading should be added to CHANGELOG.md',
      failText:
        'Failed to check if the "Dependencies" heading should be added to CHANGELOG.md',
    },
    async (spinner) => {
      const unreleasedVersion =
        parsedChangelog.versions[UNRELEASED_VERSION_INDEX]
      if (
        !unreleasedVersion ||
        !unreleasedVersion.title.toLowerCase().includes('unreleased')
      ) {
        throw new Error('"Unreleased" heading in CHANGELOG.md does not exist')
      }

      const dependenciesChangelogHeading = '### Dependencies'

      if (unreleasedVersion.body.includes(dependenciesChangelogHeading)) {
        spinner.warn(
          'Skipping inserting the "Dependencies" heading in CHANGELOG.md as it already exists under the "Unreleased" heading. It is recommended to allow this release process to insert instead of adding them as dependencies change.',
        )
        return ''
      }

      const lastVersion = parsedChangelog.versions[1]
      if (!lastVersion) {
        spinner.info(
          'Skipping inserting the "Dependencies" heading in CHANGELOG.md as this is the first release according to the CHANGELOG.md.',
        )
        return ''
      }

      let dependenciesChangelogEntries = ''
      const lastGitTag = `${GIT_TAG_PREFIX}${lastVersion.version}`
      try {
        const result = await packageDiffSummary({
          cwd,
          previousVersion: lastGitTag,
        })
        if (result) {
          dependenciesChangelogEntries = result.trim()
        }
      } catch (error) {
        if (
          (error as Error).message.includes(
            `git show ${lastGitTag}:package.json`,
          )
        ) {
          spinner.warn(
            `Skipping inserting the "Dependencies" heading in CHANGELOG.md as it relies on the last release's git tag having a "v" prefix (i.e. "${lastGitTag}")`,
          )
          return ''
        }
        throw error
      }

      if (!dependenciesChangelogEntries) {
        spinner.info(
          `Skipping inserting the "Dependencies" heading in CHANGELOG.md as there were no dependency changes since the last release (${lastVersion.version})`,
        )
        return ''
      }

      spinner.succeed('"Dependencies" heading will be added to CHANGELOG.md')

      return `
${dependenciesChangelogHeading}

${dependenciesChangelogEntries}
`
    },
  )

  const nextReleaseTitle = `[${nextSemverVersion}] - ${new Date()
    .toISOString()
    .substring(0, 10)}`
  const releaseNameSubtitle = releaseName
    ? `

##### Release Name: ${releaseName}`
    : ''

  await wrapWithLoading(
    {
      startText: `Updating CHANGELOG.md with next release (${nextReleaseTitle})`,
      failText: `Failed to update CHANGELOG.md with next release (${nextReleaseTitle})`,
    },
    async (spinner) => {
      let prettierOptions = {}
      try {
        const s = await readFileAsync(path.join(cwd, '.prettierrc'), 'utf-8')
        prettierOptions = JSON.parse(s)
      } catch (error) {
        // ignore errors attempting to find prettier configuration
      }

      const changelog = await prettier.format(
        `
# ${parsedChangelog.title}

${parsedChangelog.description || ''}

${parsedChangelog.versions
  .map(({ title, body }, index) => {
    if (index === UNRELEASED_VERSION_INDEX) {
      return `
## ${title}

## ${nextReleaseTitle}${releaseNameSubtitle}

${body}

${dependenciesChangelogEntry}
`
    }

    return `
## ${title}

${body}
`
  })
  .join('')}`,
        {
          ...prettierOptions,
          parser: 'markdown',
        },
      )
      await writeFileAsync(changelogPath, changelog, 'utf-8')
      spinner.succeed(
        `Updated CHANGELOG.md with next release (${nextReleaseTitle})`,
      )
    },
  )
}

async function checkIfNPMPackageVersionShouldBeUpdated(
  cwd: string,
): Promise<boolean> {
  const result = await readPackageUp({
    cwd,
  })

  return !!result?.packageJson
}

async function executeCommand(command: string, args: string[], cwd: string) {
  await wrapWithLoading(
    {
      startText: `Running "${command} ${args.join(' ')}"`,
      failText: `Failed to run "${command} ${args.join(' ')}"`,
    },
    async (spinner) => {
      await execa(command, args, {
        cwd,
      })
      spinner.succeed(`Ran "${command} ${args.join(' ')}"`)
    },
  )
}

export default async function startReleaseProcess({
  nextVersion,
  preRelease,
  cwd,
  git,
  releaseName,
}: {
  nextVersion: string
  preRelease: string | undefined
  git: boolean
  releaseName: string | undefined
  cwd: string
}): Promise<void> {
  const nextSemverVersion = semver.valid(nextVersion)
  if (!nextSemverVersion) {
    throw new Error('Next version is not valid semver')
  }

  const npm = await checkIfNPMPackageVersionShouldBeUpdated(cwd)

  if (preRelease) {
    const text = `Skipping changelog updates for "${preRelease}" release`
    ora(text).start().info(text)
  } else {
    await updateChangelog({
      nextSemverVersion,
      cwd,
      releaseName,
    })
  }

  if (npm) {
    await executeCommand(
      'npm',
      ['version', nextSemverVersion, '--no-git-tag-version'],
      cwd,
    )
  }

  if (!git) {
    const text = `Skipping committing release changes using git`
    ora(text).start().info(text)
    return
  }

  const message = `[RELEASE] ${nextSemverVersion}${
    releaseName ? ` - ${releaseName}` : ''
  }`

  await executeCommand('git', ['add', '-A'], cwd)
  await executeCommand('git', ['commit', '--message', message], cwd)
  await executeCommand('git', ['push'], cwd)
  await executeCommand(
    'git',
    ['tag', '-a', `${GIT_TAG_PREFIX}${nextSemverVersion}`, '-m', message],
    cwd,
  )
  await executeCommand('git', ['push', '--tags'], cwd)
}
