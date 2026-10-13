import executeCommand from '../executeCommand.js'
import {
  PushBranchForReviewOptions,
  PushBranchForReviewResult,
  SourceCodeProvider,
} from './SourceCodeProvider.js'

/**
 * For git.drupal.org hosting Does not support GitLab merge-request push
 * options. For Drupal projects on GitLab, use {@link GitLabSourceCodeProvider}
 * instead.
 */
export default class DrupalGitSourceCodeProvider extends SourceCodeProvider {
  readonly displayName = 'Drupal Git'
  readonly cloneUrl: string

  readonly projectName: string

  constructor({ projectName }: { projectName: string }) {
    super()
    this.projectName = projectName
    this.cloneUrl = `git@git.drupal.org:project/${projectName}.git`
  }

  projectWebUrl(): string {
    return `https://www.drupal.org/project/${this.projectName}`
  }

  async pushBranchForReview({
    cwd,
    branchName,
  }: PushBranchForReviewOptions): Promise<PushBranchForReviewResult> {
    await executeCommand('git', ['push', '-u', 'origin', branchName], cwd)
    return {
      url: this.projectWebUrl(),
      created: false,
    }
  }
}
