import {
  PushBranchForReviewOptions,
  PushBranchForReviewResult,
  SourceCodeProvider,
} from './SourceCodeProvider.js'

export default class UnconfiguredSourceCodeProvider extends SourceCodeProvider {
  readonly displayName = 'Local working copy'
  readonly cloneUrl: string

  constructor({ cloneUrl }: { cloneUrl: string }) {
    super()
    this.cloneUrl = cloneUrl
  }

  async pushBranchForReview(
    _options: PushBranchForReviewOptions,
  ): Promise<PushBranchForReviewResult> {
    void _options
    throw new Error(
      'Could not determine a source code provider from `git remote get-url origin`. Add this repository to the product catalog or use a recognised git host before opening an automated code review.',
    )
  }
}
