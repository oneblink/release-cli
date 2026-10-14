import { SemVer } from 'semver'
import { SourceCodeProvider } from '../source-code-providers/SourceCodeProvider.js'

/** Result of an automated vulnerability fix run for a pull request. */
export type FixVulnerabilitiesResult = {
  filesToStage: string[]
  commitMessage: string
  pullRequestBody: string
}

/** Default prefix for release git tags on npm, NuGet, and similar repositories. */
export const DEFAULT_GIT_TAG_PREFIX = 'v'

/** Builds the annotated git tag name for a release version. */
export function formatRepositoryGitTag(
  gitTagPrefix: string,
  version: string,
): string {
  return `${gitTagPrefix}${version}`
}

/**
 * Stack-specific release mechanics for a product repository (npm, NuGet,
 * Drupal module, and so on). Separate from {@link SourceCodeProvider}, which
 * handles where source is hosted and how branches are pushed for review.
 */
export interface RepositoryPlugin {
  /** Hosting for this repository (GitHub, GitLab, Drupal Git, etc.). */
  sourceCodeProvider: SourceCodeProvider
  /** When true, the release flow waits for deployment after the git release. */
  isDeploymentRequired: boolean
  /** When true, `update-dependents` may bump this repo as a dependency. */
  supportsDependencyUpdates: boolean
  /** Human-readable label shown in CLI prompts (e.g. "NPM", "Drupal module"). */
  displayType: string
  /** Working directory of the repository being released. */
  cwd: string
  /** Prepended to semver when creating release git tags (Drupal modules use ''). */
  gitTagPrefix: string

  /** Reads the version from stack-specific project files (package.json, etc.). */
  getCurrentVersion(): Promise<string | undefined>

  /** Writes the next version into stack-specific project files. */
  incrementVersion(nextSemverVersion: SemVer): Promise<void>

  /**
   * When set, supplies the next version without prompting (e.g. NodeJS minor bump).
   */
  autoIncrementVersion?: (
    currentSemverVersion: SemVer,
  ) => Promise<string | undefined>

  /**
   * When set, builds a "Dependencies" changelog section by diffing against
   * `previousVersion` (typically the last release git tag).
   */
  generateDependenciesChangelog?: (options: {
    previousVersion: string
  }) => Promise<
    | { result: 'ENTRIES'; entries: string | undefined }
    | { result: 'WARNING'; message: string }
  >

  /**
   * When set, runs stack-specific audit/fix commands and returns changes to
   * commit for a vulnerability-fix pull request.
   */
  fixVulnerabilities?: (options: {
    ticket: string
    repositoryName: string
  }) => Promise<FixVulnerabilitiesResult | undefined>
}
