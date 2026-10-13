/**
 * Where product source is hosted. Separate from repository plugins, which
 * handle stack-specific release mechanics (npm, NuGet, Drupal module
 * versioning).
 */
export type PushBranchForReviewOptions = {
  cwd: string
  branchName: string
  title: string
  body?: string
}

export type PushBranchForReviewResult = {
  url: string
  created: boolean
}

export abstract class SourceCodeProvider {
  abstract readonly displayName: string
  abstract readonly cloneUrl: string
  readonly deploymentUrl?: string

  /** Push a branch and open a code review where the host supports it. */
  abstract pushBranchForReview(
    options: PushBranchForReviewOptions,
  ): Promise<PushBranchForReviewResult>
}
