import { setTimeout } from 'node:timers/promises'
import { execa } from 'execa'
import wrapWithLoading from './wrapWithLoading.js'

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000
const DEFAULT_POLL_INTERVAL_MS = 15_000

export default async function waitForNpmPackageVersion({
  packageName,
  version,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: {
  packageName: string
  version: string
  timeoutMs?: number
  pollIntervalMs?: number
}): Promise<void> {
  await wrapWithLoading(
    {
      startText: `Waiting for ${packageName}@${version} to be published to npm`,
      failText: `Timed out waiting for ${packageName}@${version} to be published to npm`,
    },
    async (spinner) => {
      const startedAt = Date.now()

      while (Date.now() - startedAt < timeoutMs) {
        const { stdout, exitCode } = await execa(
          'npm',
          ['view', `${packageName}@${version}`, 'version'],
          {
            reject: false,
          },
        )

        if (exitCode === 0 && stdout.trim() === version) {
          spinner.succeed(`${packageName}@${version} is available on npm`)
          return
        }

        const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000)
        spinner.text = `Waiting for ${packageName}@${version} to be published to npm (${elapsedSeconds}s)`
        await setTimeout(pollIntervalMs)
      }

      throw new Error(
        `Timed out after ${timeoutMs}ms waiting for ${packageName}@${version} to be published to npm. Investigate why the package was not published (for example CI or npm publish failures), then decide whether it is safe to run the command again from the beginning.`,
      )
    },
  )
}
