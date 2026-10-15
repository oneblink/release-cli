import GitLabSourceCodeProvider from './GitLabSourceCodeProvider.js'

/** Drupal contrib/custom projects hosted on git.drupal.org (GitLab). */
export default class DrupalGitSourceCodeProvider extends GitLabSourceCodeProvider {
  static fromGitRemote(
    remote: string,
  ): DrupalGitSourceCodeProvider | undefined {
    const ssh = /^git@git\.drupal\.org:project\/([^/]+?)(?:\.git)?$/i
    const match = remote.match(ssh)
    if (!match) {
      return undefined
    }

    return new DrupalGitSourceCodeProvider({
      projectName: match[1],
    })
  }

  readonly projectName: string
  readonly deploymentUrl: string

  constructor({ projectName }: { projectName: string }) {
    super({
      host: 'git.drupal.org',
      projectPath: `project/${projectName}`,
      displayName: 'Drupal Git',
    })
    this.projectName = projectName
    this.deploymentUrl = `https://www.drupal.org/project/${projectName}`
  }
}
