import { readFile } from 'fs/promises'
import { glob } from 'glob'
import { parser, Release } from 'keep-a-changelog'
import prettier from 'prettier'
import wrapWithLoading from '../terminal/wrapWithLoading.js'
export const CHANGELOG_ENTRIES_DIRECTORY_NAME = 'changelog-entries'

export default async function generateCodeChangelogEntries({
  cwd,
  entriesInChangelog,
}: {
  cwd: string
  entriesInChangelog: string | undefined
}) {
  return await wrapWithLoading(
    {
      startText: `Generating changelog entries from the "${CHANGELOG_ENTRIES_DIRECTORY_NAME}" directory`,
      failText: `Failed to generate changelog entries from the "${CHANGELOG_ENTRIES_DIRECTORY_NAME}" directory`,
    },
    async (spinner) => {
      const entryFilePaths = await glob(
        `${CHANGELOG_ENTRIES_DIRECTORY_NAME}/**`,
        {
          absolute: true,
          cwd,
          nodir: true,
        },
      )

      const finalRelease = new Release()

      if (entriesInChangelog) {
        appendEntryToRelease(entriesInChangelog, finalRelease)
      }

      const entryFiles: Array<{
        filePath: string
        markdown: string
      }> = []
      for (const entryFilePath of entryFilePaths) {
        const entry = await readFile(entryFilePath, 'utf-8')
        entryFiles.push({
          filePath: entryFilePath,
          markdown: entry,
        })
        appendEntryToRelease(entry, finalRelease)
      }

      const releaseChangelogEntries = finalRelease
        .toString()
        .replace('## Unreleased', '')
      const formatted = await prettier.format(releaseChangelogEntries, {
        parser: 'markdown',
      })

      if (!entryFiles.length) {
        spinner.info(
          `Skipping inserting changelog entries from the "${CHANGELOG_ENTRIES_DIRECTORY_NAME}" directory to the CHANGELOG.md as there were no markdown files in the directory`,
        )
        return {
          formatted,
          entryFiles,
        }
      }

      spinner.succeed(
        `Changelog entries from the "${CHANGELOG_ENTRIES_DIRECTORY_NAME}" directory will be added to CHANGELOG.md`,
      )

      return {
        formatted,
        entryFiles,
      }
    },
  )
}
function appendEntryToRelease(entry: string, finalRelease: Release) {
  const parsed = parser(`# Changelog

## Unreleased

${entry}`)
  for (const release of parsed.releases) {
    for (const [type, changes] of release.changes) {
      for (const change of changes) {
        finalRelease.addChange(type, change)
      }
    }
  }
}
