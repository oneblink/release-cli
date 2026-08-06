import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import { SemVer } from 'semver'
import getPreRelease from '../getPreRelease.js'
import {
  getChangedFilesMatching,
  runCommandAllowingRemainingVulnerabilities,
} from './fix-vulnerabilities-helpers.js'
import {
  FixVulnerabilitiesResult,
  RepositoryPlugin,
} from './RepositoryPlugin.js'

export default class NugetPlugin implements RepositoryPlugin {
  isDeploymentRequired = false
  supportsDependencyUpdates = false
  displayType = 'Nuget'

  cwd: string
  relativeProjectFile: string

  constructor({
    cwd,
    relativeProjectFile,
  }: {
    cwd: string
    relativeProjectFile: string
  }) {
    this.cwd = cwd
    this.relativeProjectFile = relativeProjectFile
  }

  async getCurrentVersion(): Promise<string | undefined> {
    const projectFile = path.join(this.cwd, this.relativeProjectFile)
    const file = await readFile(projectFile, 'utf-8')
    const matches = file.match(/<PackageVersion>(.*)<\/PackageVersion>/)
    return matches?.[1]
  }

  async incrementVersion(nextSemverVersion: SemVer): Promise<void> {
    const projectFile = path.join(this.cwd, this.relativeProjectFile)
    const fileContents = await readFile(projectFile, 'utf-8')
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
    await writeFile(projectFile, newFileContents, 'utf-8')
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
