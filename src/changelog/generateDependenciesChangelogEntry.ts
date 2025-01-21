import parseChangelog from 'changelog-parser'
import wrapWithLoading from '../terminal/wrapWithLoading.js'
import { RepositoryPlugin } from '../repositories-plugins/RepositoryPlugin.js'

const UNRELEASED_VERSION_INDEX = 0
const GIT_TAG_PREFIX = 'v'

export default async function generateDependenciesChangelogEntry({
  parsedChangelog,
  repositoryPlugin,
}: {
  parsedChangelog: parseChangelog.Changelog
  repositoryPlugin: RepositoryPlugin
}): Promise<string> {
  return await wrapWithLoading(
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
}
