import semver from 'semver'
import ora from 'ora'
import executeCommand from '../terminal/executeCommand.js'
import getPreRelease from '../utils/getPreRelease.js'
import { RepositoryPlugin } from '../repositories-plugins/RepositoryPlugin.js'
import addNextReleaseToChangelog from '../changelog/addNextReleaseToChangelog.js'

const GIT_TAG_PREFIX = 'v'

export default async function startRepositoryRelease({
  nextVersion,
  git,
  releaseName,
  repositoryPlugin,
}: {
  nextVersion: string
  git: boolean
  releaseName: string | undefined
  repositoryPlugin: RepositoryPlugin
}): Promise<void> {
  const nextSemverVersion = semver.parse(nextVersion)
  if (!nextSemverVersion) {
    throw new Error('Next version is not valid semver')
  }

  const preRelease = getPreRelease(nextVersion)

  if (preRelease) {
    const text = `Skipping changelog updates for "${preRelease.tag}" release`
    ora(text).start().info(text)
  } else {
    await addNextReleaseToChangelog({
      nextSemverVersion,
      releaseName,
      repositoryPlugin,
    })
  }

  await repositoryPlugin.incrementVersion(nextSemverVersion)

  if (!git) {
    const text = `Skipping committing release changes using git`
    ora(text).start().info(text)
    return
  }

  const message = `[RELEASE] ${nextSemverVersion.version}${
    releaseName ? ` - ${releaseName}` : ''
  }`

  await executeCommand('git', ['add', '-A'], repositoryPlugin.cwd)
  await executeCommand(
    'git',
    ['commit', '--message', message],
    repositoryPlugin.cwd,
  )
  await executeCommand('git', ['push'], repositoryPlugin.cwd)
  await executeCommand(
    'git',
    [
      'tag',
      '-a',
      `${GIT_TAG_PREFIX}${nextSemverVersion.version}`,
      '-m',
      message,
    ],
    repositoryPlugin.cwd,
  )
  await executeCommand('git', ['push', '--tags'], repositoryPlugin.cwd)
}
