import boxen from 'boxen'
import chalk from 'chalk'
import { CHANGELOG_ENTRIES_DIRECTORY_NAME } from '../changelog/generateCodeChangelogEntries.js'
import generateNextReleaseChangelogEntries from '../changelog/generateNextReleaseChangelogEntries.js'
import getRepositoryPlugin from '../repositories-plugins/plugins-factory.js'

export default async function startChangelogPreview({ cwd }: { cwd: string }) {
  const repositoryPlugin = await getRepositoryPlugin({
    cwd,
  })
  const { nextReleaseChangelogEntries, changelogEntryFiles } =
    await generateNextReleaseChangelogEntries({
      repositoryPlugin,
    })
  if (!nextReleaseChangelogEntries) {
    console.log(
      chalk.yellow(
        `There are no changelog entry files in the "${CHANGELOG_ENTRIES_DIRECTORY_NAME}" directory and there were no dependency changes`,
      ),
    )
    process.exitCode = 1
    return
  }

  console.log(
    boxen(
      changelogEntryFiles.map(({ filePath }) => filePath).join(`
`),
      {
        title: 'Unreleased Entry Files',
        padding: 1,
        margin: {
          top: 1,
          bottom: 1,
        },
      },
    ),
  )
  console.log(
    boxen(chalk.blue(nextReleaseChangelogEntries), {
      title: 'Unreleased Entries',
      padding: 1,
      margin: {
        top: 1,
        bottom: 1,
      },
    }),
  )
}
