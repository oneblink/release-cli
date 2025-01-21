import fs from 'fs/promises'
import prettier from 'prettier'
import { SemVer } from 'semver'
import wrapWithLoading from '../terminal/wrapWithLoading.js'
import { RepositoryPlugin } from '../repositories-plugins/RepositoryPlugin.js'
import generateNextReleaseChangelogEntries, {
  UNRELEASED_VERSION_INDEX,
} from './generateNextReleaseChangelogEntries.js'

export default async function addNextReleaseToChangelog({
  nextSemverVersion,
  releaseName,
  repositoryPlugin,
}: {
  nextSemverVersion: SemVer
  releaseName: string | undefined
  repositoryPlugin: RepositoryPlugin
}) {
  const {
    parsedChangelog,
    changelogPath,
    nextReleaseChangelogEntries,
    changelogEntryFiles,
  } = await generateNextReleaseChangelogEntries({ repositoryPlugin })

  const nextReleaseTitle = `[${nextSemverVersion.version}] - ${new Date()
    .toISOString()
    .substring(0, 10)}`
  const releaseNameSubtitle = releaseName
    ? `##### Release Name: ${releaseName}`
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

## ${nextReleaseTitle}

${releaseNameSubtitle}

${nextReleaseChangelogEntries}
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
      await fs.writeFile(changelogPath, changelog, 'utf-8')
      spinner.succeed(
        `Updated CHANGELOG.md with next release (${nextReleaseTitle})`,
      )
    },
  )

  for (const { filePath } of changelogEntryFiles) {
    wrapWithLoading(
      {
        startText: `Deleting file: "${filePath}"`,
        failText: `Failed to delete file: "${filePath}"`,
      },
      async (spinner) => {
        await fs.unlink(filePath)
        spinner.succeed(`Deleted file: "${filePath}"`)
      },
    )
  }
}
