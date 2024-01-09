import enquirer from 'enquirer'
import { readPackageUp } from 'read-package-up'
import semver from 'semver'
import { RepositoryType } from './getRepositoryType.js'
import { getNugetVersion } from './nuget.js'

async function getCurrentVersion({
  type,
  cwd,
}: {
  type: RepositoryType
  cwd: string
}): Promise<string | undefined> {
  switch (type.type) {
    case 'NODE_JS':
    case 'NPM': {
      const result = await readPackageUp({
        cwd,
      })
      return result?.packageJson.version
    }
    case 'NUGET': {
      return await getNugetVersion({
        cwd,
        relativeProjectFile: type.relativeProjectFile,
      })
    }
  }
}

export default async function promptForNextVersion({
  type,
  cwd,
}: {
  type: RepositoryType
  cwd: string
}): Promise<{
  nextVersion: string
}> {
  const currentVersion = await getCurrentVersion({
    type,
    cwd,
  })
  if (!semver.valid(currentVersion)) {
    throw new Error(
      `Could not determine current version for repository: ${cwd}`,
    )
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
      return true
    },
  })
}
