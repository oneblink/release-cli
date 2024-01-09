import fs from 'fs'
import path from 'path'
import util from 'util'

import prettier from 'prettier'
import { main as packageDiffSummary } from './package-diff-summary/index.js'
import semver, { SemVer } from 'semver'
import ora from 'ora'
import { RepositoryType } from './getRepositoryType.js'
import wrapWithLoading from './wrapWithLoading.js'
import executeCommand from './executeCommand.js'
import parseChangelogWithLoading from './parseChangelogWithLoading.js'
import { updateNugetVersion } from './nuget.js'
import { getPreRelease } from './promptForNextVersion.js'

const readFileAsync = util.promisify(fs.readFile)
const writeFileAsync = util.promisify(fs.writeFile)

const UNRELEASED_VERSION_INDEX = 0
const GIT_TAG_PREFIX = 'v'

async function updateChangelog({
  nextSemverVersion,
  cwd,
  releaseName,
  type,
}: {
  nextSemverVersion: SemVer
  cwd: string
  releaseName: string | undefined
  type: RepositoryType
}) {
  const { parsedChangelog, changelogPath } =
    await parseChangelogWithLoading(cwd)

  const dependenciesChangelogEntry = await wrapWithLoading(
    {
      startText:
        'Checking if the "Dependencies" heading should be added to CHANGELOG.md',
      failText:
        'Failed to check if the "Dependencies" heading should be added to CHANGELOG.md',
    },
    async (spinner) => {
      switch (type.type) {
        case 'NUGET': {
          spinner.info(
            `Evaluating "Dependencies" is not supported for ${type.type} repositories.`,
          )
          return ''
        }
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

export default async function startRepositoryRelease({
  nextVersion,
  cwd,
  git,
  releaseName,
  type,
}: {
  nextVersion: string
  git: boolean
  releaseName: string | undefined
  cwd: string
  type: RepositoryType
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
      cwd,
      releaseName,
      type,
    })
  }

  switch (type.type) {
    case 'NODE_JS':
    case 'NPM': {
      await executeCommand(
        'npm',
        ['version', nextSemverVersion.version, '--no-git-tag-version'],
        cwd,
      )
      break
    }
    case 'NUGET': {
      await updateNugetVersion({
        relativeProjectFile: type.relativeProjectFile,
        nextSemverVersion,
        cwd,
      })
      break
    }
  }

  if (!git) {
    const text = `Skipping committing release changes using git`
    ora(text).start().info(text)
    return
  }

  const message = `[RELEASE] ${nextSemverVersion.version}${
    releaseName ? ` - ${releaseName}` : ''
  }`

  await executeCommand('git', ['add', '-A'], cwd)
  await executeCommand('git', ['commit', '--message', message], cwd)
  await executeCommand('git', ['push'], cwd)
  await executeCommand(
    'git',
    [
      'tag',
      '-a',
      `${GIT_TAG_PREFIX}${nextSemverVersion.version}`,
      '-m',
      message,
    ],
    cwd,
  )
  await executeCommand('git', ['push', '--tags'], cwd)
}
