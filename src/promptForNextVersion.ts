import enquirer from 'enquirer'
import semver from 'semver'
import getPreRelease from './getPreRelease.js'
import { RepositoryPlugin } from './repositories-plugins/RepositoryPlugin.js'

export default async function promptForNextVersion({
  repositoryPlugin,
  noPreRelease,
}: {
  repositoryPlugin: RepositoryPlugin
  noPreRelease: boolean
}): Promise<{
  nextVersion: string
}> {
  const currentVersion = await repositoryPlugin.getCurrentVersion()

  const currentSemverVersion = semver.parse(currentVersion)
  if (!currentSemverVersion) {
    throw new Error(
      `Could not determine current version for ${repositoryPlugin.displayType} repository: ${repositoryPlugin.cwd}`,
    )
  }

  const autoIncrementVersion =
    await repositoryPlugin.autoIncrementVersion?.(currentSemverVersion)
  if (autoIncrementVersion) {
    return {
      nextVersion: autoIncrementVersion,
    }
  }

  return await enquirer.prompt<{ nextVersion: string }>({
    type: 'input',
    message: 'Next version? e.g. "1.2.3" or "1.2.3-beta.1"',
    name: 'nextVersion',
    required: true,
    initial: currentVersion,
    validate: (value) => {
      if (value === currentVersion) {
        return `Next version must be different to the current version (${currentVersion})`
      }

      const nextSemverVersion = semver.valid(value)
      if (!nextSemverVersion) {
        return 'Next version must be valid semver'
      }

      if (noPreRelease && getPreRelease(value)) {
        return 'Next version must not be a prerelease version'
      }

      return true
    },
  })
}
