import { mkdtemp, rm } from 'fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import executeCommand from './executeCommand.js'
import wrapWithLoading from './wrapWithLoading.js'

export default async function prepareCloneRepository({
  repositoryName,
}: {
  repositoryName: string
}) {
  const repositoryWorkingDirectory = await wrapWithLoading(
    {
      startText: `Creating temporary directory to clone "${repositoryName}"`,
      failText: `Failed to create temporary directory to clone "${repositoryName}"`,
    },
    async (spinner) => {
      const directory = await mkdtemp(join(tmpdir(), repositoryName))
      spinner.succeed(
        `Created temporary directory to clone "${repositoryName}"`,
      )
      return directory
    },
  )

  return {
    repositoryWorkingDirectory,
    async cloneRepository() {
      const cloneUrl = `git@github.com:oneblink/${repositoryName}.git`
      await executeCommand(
        'git',
        ['clone', cloneUrl, repositoryWorkingDirectory],
        '.',
      )
      return cloneUrl
    },
    async removeRepositoryWorkingDirectory() {
      await wrapWithLoading(
        {
          startText: `Removing temporary directory for "${repositoryName}"`,
          failText: `Failed to remove temporary directory for "${repositoryName}"`,
        },
        async (spinner) => {
          await rm(repositoryWorkingDirectory, {
            recursive: true,
            force: true,
          })
          spinner.succeed(`Removed temporary directory for "${repositoryName}"`)
        },
      )
    },
  }
}
