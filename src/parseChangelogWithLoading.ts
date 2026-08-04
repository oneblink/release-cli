import path from 'path'
import { readFile } from 'fs/promises'
import parseChangelog from 'changelog-parser'
import wrapWithLoading from './wrapWithLoading.js'

export default async function parseChangelogWithLoading(cwd: string) {
  const changelogPath = path.join(cwd, 'CHANGELOG.md')
  const parsedChangelog = await wrapWithLoading(
    {
      startText: `Parsing ${changelogPath}`,
      failText: `Failed to parsed ${changelogPath}`,
    },
    async (spinner) => {
      // Pass file contents as text so changelog-parser splits on any newline
      // style. Passing filePath uses os.EOL and breaks on Windows for LF files.
      const changelogText = await readFile(changelogPath, 'utf-8')
      const parsedChangelog = await parseChangelog({
        text: changelogText,
      })
      spinner.succeed(`Parsed ${changelogPath}`)
      return parsedChangelog
    },
  )
  return { parsedChangelog, changelogPath }
}
