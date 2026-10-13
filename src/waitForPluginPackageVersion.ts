import { readPackageUp } from 'read-package-up'
import { RepositoryPlugin } from './repositories-plugins/RepositoryPlugin.js'
import NugetPlugin from './repositories-plugins/NugetPlugin.js'
import waitForNpmPackageVersion from './waitForNpmPackageVersion.js'
import waitForNugetPackageVersion from './waitForNugetPackageVersion.js'

export default async function waitForPluginPackageVersion({
  repositoryPlugin,
  version,
  timeoutMs,
  pollIntervalMs,
}: {
  repositoryPlugin: RepositoryPlugin
  version: string
  timeoutMs?: number
  pollIntervalMs?: number
}): Promise<void> {
  if (repositoryPlugin instanceof NugetPlugin) {
    await waitForNugetPackageVersion({
      packageName: await repositoryPlugin.getPackageId(),
      version,
      timeoutMs,
      pollIntervalMs,
    })
    return
  }

  const packageResult = await readPackageUp({
    cwd: repositoryPlugin.cwd,
  })
  const packageName = packageResult?.packageJson.name
  if (!packageName) {
    throw new Error(
      `Could not determine the package name for waiting on a published version in: ${repositoryPlugin.cwd}`,
    )
  }
  if (packageResult.packageJson.private) {
    throw new Error(
      `Cannot wait for a published version of private package "${packageName}" because it is not published to npm.`,
    )
  }

  await waitForNpmPackageVersion({
    packageName,
    version,
    timeoutMs,
    pollIntervalMs,
  })
}
