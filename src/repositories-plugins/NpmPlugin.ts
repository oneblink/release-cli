import { readPackageUp } from 'read-package-up'
import { main as packageDiffSummary } from '../package-diff-summary/index.js'
import { SemVer } from 'semver'
import executeCommand from '../executeCommand.js'
import { RepositoryPlugin } from './RepositoryPlugin.js'

export default class NpmPlugin implements RepositoryPlugin {
  displayType = 'NPM'
  isDeploymentRequired = false
  cwd: string

  constructor({ cwd }: { cwd: string }) {
    this.cwd = cwd
  }

  async getCurrentVersion(): Promise<string | undefined> {
    const result = await readPackageUp({
      cwd: this.cwd,
    })
    return result?.packageJson.version
  }

  async incrementVersion(nextSemverVersion: SemVer): Promise<void> {
    await executeCommand(
      'npm',
      ['version', nextSemverVersion.version, '--no-git-tag-version'],
      this.cwd,
    )
  }

  async generateDependenciesChangelog({
    previousVersion,
  }: {
    previousVersion: string
  }): Promise<
    | { result: 'ENTRIES'; entries: string | undefined }
    | { result: 'WARNING'; message: string }
  > {
    try {
      const entries = await packageDiffSummary({
        cwd: this.cwd,
        previousVersion,
      })
      return {
        result: 'ENTRIES',
        entries,
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes(`git show ${previousVersion}:package.json`)
      ) {
        return {
          result: 'WARNING',
          message: `Skipping inserting the "Dependencies" heading in CHANGELOG.md as it relies on the last release's git tag having a "v" prefix (i.e. "${previousVersion}")`,
        }
      }
      throw error
    }
  }
}
