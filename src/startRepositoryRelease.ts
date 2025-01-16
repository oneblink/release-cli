import fs from 'fs'
import util from 'util'
import { EOL } from 'os'

import prettier from 'prettier'
import semver, { SemVer } from 'semver'
import ora from 'ora'
import wrapWithLoading from './wrapWithLoading.js'
import executeCommand from './executeCommand.js'
import parseChangelogWithLoading from './parseChangelogWithLoading.js'
import getPreRelease from './getPreRelease.js'
import { RepositoryPlugin } from './repositories-plugins/RepositoryPlugin.js'

const writeFileAsync = util.promisify(fs.writeFile)

const UNRELEASED_VERSION_INDEX = 0
const GIT_TAG_PREFIX = 'v'

async function updateChangelog({
  nextSemverVersion,
  releaseName,
  repositoryPlugin,
}: {
  nextSemverVersion: SemVer
  releaseName: string | undefined
  repositoryPlugin: RepositoryPlugin
}) {
  const { parsedChangelog, changelogPath } = await parseChangelogWithLoading(
    repositoryPlugin.cwd,
  )

  const dependenciesChangelogEntry = await wrapWithLoading(
    {
      startText:
        'Checking if the "Dependencies" heading should be added to CHANGELOG.md',
      failText:
        'Failed to check if the "Dependencies" heading should be added to CHANGELOG.md',
    },
    async (spinner) => {
      if (!repositoryPlugin.generateDependenciesChangelog) {
        spinner.info(
          `Evaluating "Dependencies" is not supported for ${repositoryPlugin.displayType} repositories.`,
        )
        return ''
      }

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

      const lastGitTag = `${GIT_TAG_PREFIX}${lastVersion.version}`
      const dependenciesChangelog =
        await repositoryPlugin.generateDependenciesChangelog({
          previousVersion: lastGitTag,
        })

      if (dependenciesChangelog.result === 'WARNING') {
        spinner.warn(dependenciesChangelog.message)
        return ''
      }

      if (!dependenciesChangelog.entries?.trim()) {
        spinner.info(
          `Skipping inserting the "Dependencies" heading in CHANGELOG.md as there were no dependency changes since the last release (${lastVersion.version})`,
        )
        return ''
      }

      spinner.succeed('"Dependencies" heading will be added to CHANGELOG.md')

      return `
${dependenciesChangelogHeading}

${dependenciesChangelog.entries}
`
    },
  )

  const nextReleaseTitle = `[${nextSemverVersion.version}] - ${new Date()
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
          parser: 'markdown',
        },
      )
      await writeFileAsync(
        changelogPath,
        changelog.replaceAll(EOL, '\n'),
        'utf-8',
      )
      spinner.succeed(
        `Updated CHANGELOG.md with next release (${nextReleaseTitle})`,
      )
    },
  )
}

export default async function startRepositoryRelease({
  nextVersion,
  git,
  releaseName,
  repositoryPlugin,
}: {
  nextVersion: string
  git: boolean
  releaseName: string | undefined
  repositoryPlugin: RepositoryPlugin
}): Promise<void> {
  const nextSemverVersion = semver.parse(nextVersion)
  if (!nextSemverVersion) {
    throw new Error('Next version is not valid semver')
  }

  const preRelease = getPreRelease(nextVersion)

  if (preRelease) {
    const text = `Skipping changelog updates for "${preRelease.tag}" release`
    ora(text).start().info(text)
  } else {
    await updateChangelog({
      nextSemverVersion,
      releaseName,
      repositoryPlugin,
    })
  }

  await repositoryPlugin.incrementVersion(nextSemverVersion)

  if (!git) {
    const text = `Skipping committing release changes using git`
    ora(text).start().info(text)
    return
  }

  const message = `[RELEASE] ${nextSemverVersion.version}${
    releaseName ? ` - ${releaseName}` : ''
  }`

  await executeCommand('git', ['add', '-A'], repositoryPlugin.cwd)
  await executeCommand(
    'git',
    ['commit', '--message', message],
    repositoryPlugin.cwd,
  )
  await executeCommand('git', ['push'], repositoryPlugin.cwd)
  await executeCommand(
    'git',
    [
      'tag',
      '-a',
      `${GIT_TAG_PREFIX}${nextSemverVersion.version}`,
      '-m',
      message,
    ],
    repositoryPlugin.cwd,
  )
  await executeCommand('git', ['push', '--tags'], repositoryPlugin.cwd)
}
