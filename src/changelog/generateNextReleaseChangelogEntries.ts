import prettier from 'prettier'
import { RepositoryPlugin } from '../repositories-plugins/RepositoryPlugin.js'
import generateCodeChangelogEntries from './generateCodeChangelogEntries.js'
import generateDependenciesChangelogEntry from './generateDependenciesChangelogEntry.js'
import parseChangelogWithLoading from './parseChangelogWithLoading.js'

export const UNRELEASED_VERSION_INDEX = 0

export default async function generateNextReleaseChangelogEntries({
  repositoryPlugin,
}: {
  repositoryPlugin: RepositoryPlugin
}) {
  const { parsedChangelog, changelogPath } = await parseChangelogWithLoading(
    repositoryPlugin.cwd,
  )

  const { formatted: codeChangelogEntries, entryFiles: changelogEntryFiles } =
    await generateCodeChangelogEntries({
      cwd: repositoryPlugin.cwd,
    })

  const dependenciesChangelogEntry = await generateDependenciesChangelogEntry({
    parsedChangelog,
    repositoryPlugin,
  })

  const nextReleaseChangelogEntries = await prettier.format(
    `
${parsedChangelog.versions[UNRELEASED_VERSION_INDEX]?.body || ''}

${codeChangelogEntries}
  
${dependenciesChangelogEntry}
`,
    {
      parser: 'markdown',
    },
  )

  return {
    changelogEntryFiles,
    parsedChangelog,
    changelogPath,
    nextReleaseChangelogEntries,
  }
}
