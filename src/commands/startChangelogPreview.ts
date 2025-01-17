import boxen from 'boxen'
import chalk from 'chalk'
import generateChangelogEntries, {
  CHANGELOG_ENTRIES_DIRECTORY_NAME,
} from '../changelog/generateCodeChangelogEntries.js'

export default async function startChangelogPreview({ cwd }: { cwd: string }) {
  const { formatted: unreleasedChangelogEntries, entryFiles } =
    await generateChangelogEntries({
      cwd,
    })
  if (!entryFiles.length) {
    console.log(
      chalk.yellow(
        `There are no changelog entry files in the "${CHANGELOG_ENTRIES_DIRECTORY_NAME}" directory`,
      ),
    )
    process.exitCode = 1
    return
  }

  console.log(
    boxen(
      entryFiles.map(({ filePath }) => filePath).join(`
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
    boxen(chalk.blue(unreleasedChangelogEntries), {
      title: 'Unreleased Entries',
      padding: 1,
      margin: {
        top: 1,
        bottom: 1,
      },
    }),
  )
}
