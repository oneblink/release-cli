import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import { SemVer } from 'semver'
import getPreRelease from '../utils/getPreRelease.js'
import { RepositoryPlugin } from './RepositoryPlugin.js'

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
}
