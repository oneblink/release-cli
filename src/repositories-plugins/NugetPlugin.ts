import { SemVer } from 'semver'
import { readRepositoryFile, writeRepositoryFile } from '../repositoryFiles.js'
import getPreRelease from '../getPreRelease.js'
import {
  getChangedFilesMatching,
  runCommandAllowingRemainingVulnerabilities,
} from './fix-vulnerabilities-helpers.js'
import { SourceCodeProvider } from '../source-code-providers/SourceCodeProvider.js'
import {
  DEFAULT_GIT_TAG_PREFIX,
  FixVulnerabilitiesResult,
  RepositoryPlugin,
} from './RepositoryPlugin.js'

export default class NugetPlugin implements RepositoryPlugin {
  isDeploymentRequired = false
  supportsDependencyUpdates = false
  displayType = 'Nuget'
  gitTagPrefix = DEFAULT_GIT_TAG_PREFIX

  cwd: string
  relativeProjectFile: string
  sourceCodeProvider: SourceCodeProvider

  constructor({
    cwd,
    relativeProjectFile,
    sourceCodeProvider,
  }: {
    cwd: string
    relativeProjectFile: string
    sourceCodeProvider: SourceCodeProvider
  }) {
    this.cwd = cwd
    this.relativeProjectFile = relativeProjectFile
    this.sourceCodeProvider = sourceCodeProvider
  }

  async getCurrentVersion(): Promise<string | undefined> {
    const file = await readRepositoryFile(this.cwd, this.relativeProjectFile)
    const matches = file.match(/<PackageVersion>(.*)<\/PackageVersion>/)
    return matches?.[1]
  }

  async incrementVersion(nextSemverVersion: SemVer): Promise<void> {
    const fileContents = await readRepositoryFile(
      this.cwd,
      this.relativeProjectFile,
    )
    const preRelease = getPreRelease(nextSemverVersion.version)
    const newFileContents = fileContents
      .replace(
        /<PackageVersion>.*<\/PackageVersion>/,
        `<PackageVersion>${nextSemverVersion.version}</PackageVersion>`,
      )
      .replace(
        /<AssemblyVersion>.*<\/AssemblyVersion>/,
        `<AssemblyVersion>${nextSemverVersion.major}.${
          nextSemverVersion.minor
        }.${nextSemverVersion.patch}.${
          preRelease?.version ?? 0
        }</AssemblyVersion>`,
      )
    await writeRepositoryFile(
      this.cwd,
      this.relativeProjectFile,
      newFileContents,
    )
  }

  async fixVulnerabilities({
    ticket,
    repositoryName,
  }: {
    ticket: string
    repositoryName: string
  }): Promise<FixVulnerabilitiesResult | undefined> {
    await runCommandAllowingRemainingVulnerabilities({
      command: 'dotnet',
      args: [
        'package',
        'update',
        '--vulnerable',
        '--project',
        this.relativeProjectFile,
      ],
      cwd: this.cwd,
      hasChanges: async () =>
        (await getChangedFilesMatching(this.cwd, '*.csproj')).length > 0,
    })

    const filesToStage = await getChangedFilesMatching(this.cwd, '*.csproj')
    if (!filesToStage.length) {
      console.log(
        `Skipping "${repositoryName}" as dotnet package update --vulnerable did not change csproj files.`,
      )
      return
    }

    return {
      filesToStage,
      commitMessage: `${ticket} # dotnet package update --vulnerable`,
      pullRequestBody: 'Automated `dotnet package update --vulnerable`.',
    }
  }
}
