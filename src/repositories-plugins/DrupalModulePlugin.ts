import { SemVer } from 'semver'
import {
  readRepositoryFile,
  RepositoryPathError,
  writeRepositoryFile,
} from '../repositoryFiles.js'
import { SourceCodeProvider } from '../source-code-providers/SourceCodeProvider.js'
import { RepositoryPlugin } from './RepositoryPlugin.js'

export default class DrupalModulePlugin implements RepositoryPlugin {
  displayType = 'Drupal module'
  isDeploymentRequired = true
  supportsDependencyUpdates = false
  gitTagPrefix = ''

  cwd: string
  relativeInfoFile: string
  sourceCodeProvider: SourceCodeProvider

  constructor({
    cwd,
    relativeInfoFile,
    sourceCodeProvider,
  }: {
    cwd: string
    relativeInfoFile: string
    sourceCodeProvider: SourceCodeProvider
  }) {
    this.cwd = cwd
    this.relativeInfoFile = relativeInfoFile
    this.sourceCodeProvider = sourceCodeProvider
  }

  async getCurrentVersion(): Promise<string | undefined> {
    try {
      const composer = JSON.parse(
        await readRepositoryFile(this.cwd, 'composer.json'),
      ) as {
        version?: string
      }
      if (composer.version) {
        return composer.version
      }
    } catch (error) {
      if (error instanceof RepositoryPathError) {
        throw error
      }
      // composer.json is optional for version discovery
    }

    try {
      const info = await readRepositoryFile(this.cwd, this.relativeInfoFile)
      const match = info.match(/^version:\s*['"]?([^'"\n]+)['"]?\s*$/m)
      if (match?.[1]) {
        return match[1]
      }
    } catch (error) {
      if (error instanceof RepositoryPathError) {
        throw error
      }
      // .info.yml missing or unreadable (composer.json was already checked above).
    }

    throw new Error(
      `Could not determine the current version for Drupal module "${this.relativeInfoFile}". Set version in composer.json or ${this.relativeInfoFile}.`,
    )
  }

  async incrementVersion(nextSemverVersion: SemVer): Promise<void> {
    try {
      const composer = JSON.parse(
        await readRepositoryFile(this.cwd, 'composer.json'),
      ) as Record<string, unknown>
      composer.version = nextSemverVersion.version
      await writeRepositoryFile(
        this.cwd,
        'composer.json',
        `${JSON.stringify(composer, null, 4)}\n`,
      )
    } catch (error) {
      if (error instanceof RepositoryPathError) {
        throw error
      }
      // composer.json is optional for version bumps
    }

    let info = await readRepositoryFile(this.cwd, this.relativeInfoFile)
    const versionLine = `version: '${nextSemverVersion.version}'`
    if (/^version:/m.test(info)) {
      info = info.replace(/^version:.*$/m, versionLine)
    } else {
      info = info.replace(/^(type: module\n)/m, `$1${versionLine}\n`)
    }
    await writeRepositoryFile(this.cwd, this.relativeInfoFile, info)
  }
}
