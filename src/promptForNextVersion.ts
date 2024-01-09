import enquirer from 'enquirer'
import { readPackageUp } from 'read-package-up'
import semver from 'semver'

export default async function promptForNextVersion({
  cwd,
}: {
  cwd: string
}): Promise<{
  nextVersion: string
}> {
  const result = await readPackageUp({
    cwd,
  })
  const currentVersion = semver.valid(result?.packageJson.version)

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
