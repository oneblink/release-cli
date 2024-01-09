import fs from 'fs/promises'
import path from 'path'

export async function getNugetVersion({
  relativeProjectFile,
  cwd,
}: {
  relativeProjectFile: string
  cwd: string
}): Promise<string | undefined> {
  const projectFile = path.join(cwd, relativeProjectFile)
  const file = await fs.readFile(projectFile, 'utf-8')
  const matches = file.match(
    /<PackageVersion>(\d+\.\d+\.\d+)<\/PackageVersion>/,
  )
  return matches?.[1]
}

export async function updateNugetVersion({
  relativeProjectFile,
  cwd,
  nextVersion,
}: {
  relativeProjectFile: string
  cwd: string
  nextVersion: string
}) {
  const projectFile = path.join(cwd, relativeProjectFile)
  const fileContents = await fs.readFile(projectFile, 'utf-8')
  const newFileContents = fileContents
    .replace(
      /<PackageVersion>\d+\.\d+\.\d+<\/PackageVersion>/,
      `<PackageVersion>${nextVersion}</PackageVersion>`,
    )
    .replace(
      /<AssemblyVersion>\d+\.\d+\.\d+\.\d+<\/AssemblyVersion>/,
      `<AssemblyVersion>${nextVersion}.0</AssemblyVersion>`,
    )
  await fs.writeFile(projectFile, newFileContents, 'utf-8')
}
