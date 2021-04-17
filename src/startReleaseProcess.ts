import fs from 'fs'
import path from 'path'
import util from 'util'

import execa from 'execa'
import prettier from 'prettier'
import parseChangelog from 'changelog-parser'
import { main as packageDiffSummary } from 'package-diff-summary'
import semver from 'semver'
import ora from 'ora'

const readFileAsync = util.promisify(fs.readFile)
const writeFileAsync = util.promisify(fs.writeFile)

const UNRELEASED_VERSION_INDEX = 0

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
  fn: (spinner: ora.Ora) => Promise<T>
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
  gitTagPrefix,
}: {
  nextSemverVersion: string
  cwd: string
  gitTagPrefix: string
}) {
  const changelogPath = path.join(cwd, 'CHANGELOG.md')
  const parsedChangelog = await wrapWithLoading(
    {
      startText: 'Parsing CHANGELOG.md',
      failText: 'Failed to parsed CHANGELOG.md',
    },
    async (spinner) => {
      const parsedChangelog = (await parseChangelog(
        changelogPath
      )) as ParsedChangelog
      spinner.succeed('Parsed CHANGELOG.md')
      return parsedChangelog
    }
  )

  const dependencies = await wrapWithLoading(
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

      const dependenciesHeading = '### Dependencies'

      if (unreleasedVersion.body.includes(dependenciesHeading)) {
        spinner.warn(
          'Skipping inserting the "Dependencies" heading in CHANGELOG.md as it already exists under the "Unreleased" heading'
        )
        return ''
      }

      const lastVersion = parsedChangelog.versions[1]
      if (!lastVersion) {
        spinner.warn(
          'Skipping inserting the "Dependencies" heading in CHANGELOG.md as this is the first release according to the CHANGELOG.md'
        )
        return ''
      }

      const result = await packageDiffSummary({
        cwd,
        previousVersion: `${gitTagPrefix}${lastVersion.version}`,
      })
      const dependencies = result.trim()

      if (!dependencies) {
        spinner.info(
          `Skipping inserting the "Dependencies" heading in CHANGELOG.md as there were not dependency changes since the last release (${lastVersion.version})`
        )
        return ''
      }

      spinner.succeed('"Dependencies" heading will be added to CHANGELOG.md')

      return `
${dependenciesHeading}

${dependencies}
`
    }
  )

  const nextReleaseTitle = `[${nextSemverVersion}] - ${new Date()
    .toISOString()
    .substring(0, 10)}`
  await wrapWithLoading(
    {
      startText: `Updating CHANGELOG.md with next release (${nextReleaseTitle})`,
      failText: `Failed to update CHANGELOG.md with next release (${nextReleaseTitle})`,
    },
    async (spinner) => {
      let prettierOptions = {}
      try {
        const s = await readFileAsync(path.join(cwd, '.prettierrc'), 'UTF-8')
        prettierOptions = JSON.parse(s)
      } catch (error) {
        // ignore errors attempting to find prettier configuration
      }

      const changelog = prettier.format(
        `
# ${parsedChangelog.title}

${parsedChangelog.description || ''}

${parsedChangelog.versions
  .map(({ title, body }, index) => {
    if (index === UNRELEASED_VERSION_INDEX) {
      return `
## ${title}

## ${nextReleaseTitle}

${body}

${dependencies}
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
        }
      )
      await writeFileAsync(changelogPath, changelog, 'UTF-8')
      spinner.succeed(
        `Updated CHANGELOG.md with next release (${nextReleaseTitle})`
      )
    }
  )
}

export default async function startReleaseProcess({
  nextVersion,
  cwd,
  git,
  npm,
}: {
  nextVersion: string | null
  git: boolean
  npm: boolean
  cwd: string
}) {
  const nextSemverVersion = semver.valid(nextVersion)
  if (!nextSemverVersion) {
    throw new Error('Next version is not valid semver')
  }

  const gitTagPrefix = npm ? 'v' : ''

  const preReleaseComponents = semver.prerelease(nextSemverVersion)
  if (preReleaseComponents && preReleaseComponents[0]) {
    const text = `Skipping changelog updates for "${preReleaseComponents[0]}" release`
    ora(text).start().info(text)
  } else {
    await updateChangelog({
      nextSemverVersion,
      cwd,
      gitTagPrefix,
    })
  }

  if (npm) {
    await wrapWithLoading(
      {
        startText: 'Running "npm version"',
        failText: 'Failed to run "npm version"',
      },
      async (spinner) => {
        await execa(
          'npm',
          ['version', nextSemverVersion, '--no-git-tag-version'],
          {
            cwd,
          }
        )
        spinner.succeed('Ran "npm version"')
      }
    )
  }

  await wrapWithLoading(
    {
      startText: 'Committing release changes using git',
      failText: 'Failed to commit release changes using git',
    },
    async (spinner) => {
      if (!git) {
        spinner.info(`Skipping committing release changes using git`)
        return
      }

      await execa('git', ['add', '-A'], {
        cwd,
      })
      await execa(
        'git',
        ['commit', '--message', `[RELEASE] ${nextSemverVersion}`],
        {
          cwd,
        }
      )
      await execa('git', ['push'], {
        cwd,
      })

      const tag = `${gitTagPrefix}${nextSemverVersion}`
      await execa('git', ['tag', tag], {
        cwd,
      })
      await execa('git', ['push', '--tags'], {
        cwd,
      })
      spinner.succeed(
        `Committed release changes using git and created tag: "${tag}"`
      )
    }
  )
}
