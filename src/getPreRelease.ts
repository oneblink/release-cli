import semver from 'semver'

/**
 * Npm-style `beta.1` and Drupal-style `beta1` in a single prerelease
 * identifier.
 */
const COMBINED_PRERELEASE_IDENTIFIER = /^(alpha|beta|rc|test)(\d+)$/i

export type PreRelease = {
  tag: string
  version: number
}

export default function getPreRelease(
  nextVersion: string,
): PreRelease | undefined {
  const prerelease = semver.prerelease(nextVersion)
  if (!prerelease?.length) {
    return undefined
  }

  const [first, second] = prerelease
  if (typeof first === 'string' && typeof second === 'number') {
    return { tag: first, version: second }
  }

  if (prerelease.length === 1 && typeof first === 'string') {
    const match = first.match(COMBINED_PRERELEASE_IDENTIFIER)
    if (match) {
      return {
        tag: match[1].toLowerCase(),
        version: Number.parseInt(match[2], 10),
      }
    }
  }

  return undefined
}
