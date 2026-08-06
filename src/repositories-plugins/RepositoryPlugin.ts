import { SemVer } from 'semver'

export type FixVulnerabilitiesResult = {
  filesToStage: string[]
  commitMessage: string
  pullRequestBody: string
}

export interface RepositoryPlugin {
  isDeploymentRequired: boolean
  supportsDependencyUpdates: boolean
  displayType: string
  cwd: string

  getCurrentVersion(): Promise<string | undefined>

  incrementVersion(nextSemverVersion: SemVer): Promise<void>

  autoIncrementVersion?: (
    currentSemverVersion: SemVer,
  ) => Promise<string | undefined>

  generateDependenciesChangelog?: (options: {
    previousVersion: string
  }) => Promise<
    | { result: 'ENTRIES'; entries: string | undefined }
    | { result: 'WARNING'; message: string }
  >

  fixVulnerabilities?: (options: {
    ticket: string
    repositoryName: string
  }) => Promise<FixVulnerabilitiesResult | undefined>
}
