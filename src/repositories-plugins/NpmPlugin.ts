import fs from 'fs/promises'
import path from 'path'
import { readPackageUp } from 'read-package-up'
import { main as packageDiffSummary } from '../package-diff-summary/index.js'
import { SemVer } from 'semver'
import executeCommand from '../executeCommand.js'
import {
  hasFileChanges,
  runCommandAllowingRemainingVulnerabilities,
} from './fix-vulnerabilities-helpers.js'
import {
  FixVulnerabilitiesResult,
  RepositoryPlugin,
} from './RepositoryPlugin.js'

export default class NpmPlugin implements RepositoryPlugin {
  displayType = 'NPM'
  isDeploymentRequired = false
  supportsDependencyUpdates = true
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

  async fixVulnerabilities({
    ticket,
    repositoryName,
  }: {
    ticket: string
    repositoryName: string
  }): Promise<FixVulnerabilitiesResult | undefined> {
    const packageLockPath = path.join(this.cwd, 'package-lock.json')
    try {
      await fs.stat(packageLockPath)
    } catch {
      console.log(
        `Skipping "${repositoryName}" as it does not contain a package-lock.json file.`,
      )
      return
    }

    await runCommandAllowingRemainingVulnerabilities({
      command: 'npm',
      args: ['audit', 'fix', '--package-lock-only', '--audit-level=none'],
      cwd: this.cwd,
      hasChanges: () => hasFileChanges(this.cwd, 'package-lock.json'),
    })

    if (!(await hasFileChanges(this.cwd, 'package-lock.json'))) {
      console.log(
        `Skipping "${repositoryName}" as npm audit fix did not change package-lock.json.`,
      )
      return
    }

    const filesToStage = ['package-lock.json']

    // npm audit fix can also update package.json when dependency ranges change
    if (await hasFileChanges(this.cwd, 'package.json')) {
      filesToStage.push('package.json')
    }

    return {
      filesToStage,
      commitMessage: `${ticket} # npm audit fix`,
      pullRequestBody: 'Automated `npm audit fix`.',
    }
  }
}
