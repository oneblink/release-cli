import path from 'path'
import parseChangelog from 'changelog-parser'
import wrapWithLoading from '../terminal/wrapWithLoading.js'

export default async function parseChangelogWithLoading(cwd: string) {
  const changelogPath = path.join(cwd, 'CHANGELOG.md')
  const parsedChangelog = await wrapWithLoading(
    {
      startText: `Parsing ${changelogPath}`,
      failText: `Failed to parsed ${changelogPath}`,
    },
    async (spinner) => {
      const parsedChangelog = await parseChangelog(changelogPath)
      spinner.succeed(`Parsed ${changelogPath}`)
      return parsedChangelog
    },
  )
  return { parsedChangelog, changelogPath }
}
