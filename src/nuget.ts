import fs from 'fs/promises'
import path from 'path'
import { SemVer } from 'semver'
import { getPreRelease } from './promptForNextVersion.js'

export async function getNugetVersion({
  relativeProjectFile,
  cwd,
}: {
  relativeProjectFile: string
  cwd: string
}): Promise<string | undefined> {
  const projectFile = path.join(cwd, relativeProjectFile)
  const file = await fs.readFile(projectFile, 'utf-8')
  const matches = file.match(/<PackageVersion>(.*)<\/PackageVersion>/)
  return matches?.[1]
}

export async function updateNugetVersion({
  relativeProjectFile,
  cwd,
  nextSemverVersion,
}: {
  relativeProjectFile: string
  cwd: string
  nextSemverVersion: SemVer
}) {
  const projectFile = path.join(cwd, relativeProjectFile)
  const fileContents = await fs.readFile(projectFile, 'utf-8')
  const preRelease = getPreRelease(nextSemverVersion.version)
  const newFileContents = fileContents
    .replace(
      /<PackageVersion>.*<\/PackageVersion>/,
      `<PackageVersion>${nextSemverVersion.version}</PackageVersion>`,
    )
    .replace(
      /<AssemblyVersion>.*<\/AssemblyVersion>/,
      `<AssemblyVersion>${nextSemverVersion.major}.${nextSemverVersion.minor}.${
        nextSemverVersion.patch
      }.${preRelease?.version ?? 0}</AssemblyVersion>`,
    )
  await fs.writeFile(projectFile, newFileContents, 'utf-8')
}
