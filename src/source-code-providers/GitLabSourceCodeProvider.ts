import executeCommand from '../executeCommand.js'
import {
  PushBranchForReviewOptions,
  PushBranchForReviewResult,
  SourceCodeProvider,
} from './SourceCodeProvider.js'

export default class GitLabSourceCodeProvider extends SourceCodeProvider {
  readonly displayName = 'GitLab'
  readonly cloneUrl: string
  readonly webBase: string

  readonly host: string
  readonly projectPath: string

  constructor({ host, projectPath }: { host: string; projectPath: string }) {
    super()
    this.host = host
    this.projectPath = projectPath.replace(/^\//, '').replace(/\.git$/, '')
    this.webBase = `https://${host}/${this.projectPath}`
    this.cloneUrl = `git@${host}:${this.projectPath}.git`
  }

  newMergeRequestUrl(branchName: string): string {
    const params = new URLSearchParams({
      'merge_request[source_branch]': branchName,
    })
    return `${this.webBase}/-/merge_requests/new?${params.toString()}`
  }

  async pushBranchForReview({
    cwd,
    branchName,
    title,
    body,
  }: PushBranchForReviewOptions): Promise<PushBranchForReviewResult> {
    const args = [
      'push',
      '-u',
      'origin',
      branchName,
      '-o',
      'merge_request.create',
      '-o',
      `merge_request.title=${title}`,
    ]

    if (body?.trim()) {
      const description = body.replace(/\n/g, '\\n')
      args.push('-o', `merge_request.description=${description}`)
    }

    await executeCommand('git', args, cwd)

    return {
      url: this.newMergeRequestUrl(branchName),
      created: true,
    }
  }
}
