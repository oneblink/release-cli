import semver from 'semver'

export default function getPreRelease(nextVersion: string) {
  const [tag, version] = semver.prerelease(nextVersion) || []
  return typeof tag === 'string' && typeof version === 'number'
    ? {
        tag,
        version,
      }
    : undefined
}
