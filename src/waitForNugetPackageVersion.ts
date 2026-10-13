import waitForRegistryPackageVersion from './waitForRegistryPackageVersion.js'

const NUGET_FLAT_CONTAINER_BASE_URL =
  'https://api.nuget.org/v3-flatcontainer'

export default async function waitForNugetPackageVersion({
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
  const packageId = packageName.toLowerCase()
  const expectedVersion = version.toLowerCase()
  const versionsUrl = `${NUGET_FLAT_CONTAINER_BASE_URL}/${encodeURIComponent(packageId)}/index.json`

  await waitForRegistryPackageVersion({
    packageName,
    version,
    registryLabel: 'NuGet',
    timeoutMs,
    pollIntervalMs,
    isVersionAvailable: async () => {
      try {
        const response = await fetch(versionsUrl)
        if (!response.ok) {
          return false
        }

        const body: unknown = await response.json()
        if (
          !body ||
          typeof body !== 'object' ||
          !('versions' in body) ||
          !Array.isArray(body.versions)
        ) {
          return false
        }

        return body.versions.some(
          (publishedVersion) =>
            typeof publishedVersion === 'string' &&
            publishedVersion.toLowerCase() === expectedVersion,
        )
      } catch {
        return false
      }
    },
  })
}
