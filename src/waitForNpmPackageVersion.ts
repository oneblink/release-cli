import { execa } from 'execa'
import waitForRegistryPackageVersion from './waitForRegistryPackageVersion.js'

export default async function waitForNpmPackageVersion({
  packageName,
  version,
  timeoutMs,
  pollIntervalMs,
}: {
  packageName: string
  version: string
  timeoutMs?: number
  pollIntervalMs?: number
}): Promise<void> {
  await waitForRegistryPackageVersion({
    packageName,
    version,
    registryLabel: 'npm',
    timeoutMs,
    pollIntervalMs,
    isVersionAvailable: async () => {
      const { stdout, exitCode } = await execa(
        'npm',
        ['view', `${packageName}@${version}`, 'version'],
        {
          reject: false,
        },
      )

      return exitCode === 0 && stdout.trim() === version
    },
  })
}
