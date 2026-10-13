import { setTimeout } from 'node:timers/promises'
import wrapWithLoading from './wrapWithLoading.js'

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000
const DEFAULT_POLL_INTERVAL_MS = 15_000

export default async function waitForRegistryPackageVersion({
  packageName,
  version,
  registryLabel,
  isVersionAvailable,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: {
  packageName: string
  version: string
  registryLabel: string
  isVersionAvailable: () => Promise<boolean>
  timeoutMs?: number
  pollIntervalMs?: number
}): Promise<void> {
  const packageLabel = `${packageName}@${version}`

  await wrapWithLoading(
    {
      startText: `Waiting for ${packageLabel} to be published to ${registryLabel}`,
      failText: `Timed out waiting for ${packageLabel} to be published to ${registryLabel}`,
    },
    async (spinner) => {
      const startedAt = Date.now()

      while (Date.now() - startedAt < timeoutMs) {
        if (await isVersionAvailable()) {
          spinner.succeed(
            `${packageLabel} is available on ${registryLabel}`,
          )
          return
        }

        const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000)
        spinner.text = `Waiting for ${packageLabel} to be published to ${registryLabel} (${elapsedSeconds}s)`
        await setTimeout(pollIntervalMs)
      }

      throw new Error(
        `Timed out after ${timeoutMs}ms waiting for ${packageLabel} to be published to ${registryLabel}. Investigate why the package was not published (for example CI or ${registryLabel} publish failures), then decide whether it is safe to run the command again from the beginning.`,
      )
    },
  )
}
