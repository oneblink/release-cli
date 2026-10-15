import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import { SemVer } from 'semver'
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
    const composerPath = path.join(this.cwd, 'composer.json')
    try {
      const composer = JSON.parse(await readFile(composerPath, 'utf-8')) as {
        version?: string
      }
      if (composer.version) {
        return composer.version
      }
    } catch {
      // composer.json is optional for version discovery
    }

    const infoPath = path.join(this.cwd, this.relativeInfoFile)
    try {
      const info = await readFile(infoPath, 'utf-8')
      const match = info.match(/^version:\s*['"]?([^'"\n]+)['"]?\s*$/m)
      if (match?.[1]) {
        return match[1]
      }
    } catch {
      // .info.yml missing or unreadable (composer.json was already checked above).
    }

    throw new Error(
      `Could not determine the current version for Drupal module "${this.relativeInfoFile}". Set version in composer.json or ${this.relativeInfoFile}.`,
    )
  }

  async incrementVersion(nextSemverVersion: SemVer): Promise<void> {
    const composerPath = path.join(this.cwd, 'composer.json')
    try {
      const composer = JSON.parse(
        await readFile(composerPath, 'utf-8'),
      ) as Record<string, unknown>
      composer.version = nextSemverVersion.version
      await writeFile(
        composerPath,
        `${JSON.stringify(composer, null, 4)}\n`,
        'utf-8',
      )
    } catch {
      // composer.json is optional for version bumps
    }

    const infoPath = path.join(this.cwd, this.relativeInfoFile)
    let info = await readFile(infoPath, 'utf-8')
    const versionLine = `version: '${nextSemverVersion.version}'`
    if (/^version:/m.test(info)) {
      info = info.replace(/^version:.*$/m, versionLine)
    } else {
      info = info.replace(/^(type: module\n)/m, `$1${versionLine}\n`)
    }
    await writeFile(infoPath, info, 'utf-8')
  }
}
