import { readdir, readFile, stat, writeFile } from 'fs/promises'
import path from 'path'

// Paths are dynamic because this CLI reads whichever repository it is releasing.
// Every path is resolved and confined to that repository root before use.

export class RepositoryPathError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RepositoryPathError'
  }
}

function resolveRepositoryPath(root: string, relativePath = ''): string {
  const rootPath = path.resolve(root)
  const resolvedPath = path.resolve(rootPath, relativePath)
  const relativeToRoot = path.relative(rootPath, resolvedPath)
  const escapesRoot =
    relativeToRoot === '..' ||
    relativeToRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToRoot)
  if (escapesRoot) {
    throw new RepositoryPathError(
      `Refusing to access a path outside ${rootPath}: ${resolvedPath}`,
    )
  }
  return resolvedPath
}

export async function readRepositoryFile(
  root: string,
  relativePath: string,
): Promise<string> {
  const filePath = resolveRepositoryPath(root, relativePath)
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return readFile(filePath, 'utf-8')
}

export async function writeRepositoryFile(
  root: string,
  relativePath: string,
  contents: string,
): Promise<void> {
  const filePath = resolveRepositoryPath(root, relativePath)
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await writeFile(filePath, contents, 'utf-8')
}

export async function repositoryFileExists(
  root: string,
  relativePath: string,
): Promise<boolean> {
  const filePath = resolveRepositoryPath(root, relativePath)
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

export async function listRepositoryEntries(root: string): Promise<string[]> {
  const directoryPath = resolveRepositoryPath(root)
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return readdir(directoryPath)
}
