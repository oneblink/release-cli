import { execa } from 'execa'

import * as http from './http.js'
import * as github from './github.js'

function changelogUrlFor(name: string, cwd: string): Promise<string> {
  return github
    .projectUrlFor(name, cwd)
    .then((projectUrl) => (projectUrl ? github.changelogUrlAt(projectUrl) : ''))
}

function nameToMarkdown(name: string): Promise<string> {
  const pkgUrl = 'https://www.npmjs.com/package/' + name
  return http
    .isUrlHealthy(pkgUrl)
    .then((yes) => (yes ? `[${name}](${pkgUrl})` : name))
}

function releaseUrlFor(
  name: string,
  version: string,
  cwd: string,
): Promise<string> {
  return github
    .projectUrlFor(name, cwd)
    .then((projectUrl) =>
      projectUrl ? github.releaseUrlFor(projectUrl, version) : '',
    )
}

function repositoryUrlFor(name: string, cwd: string): Promise<string> {
  return execa('npm', ['view', name, 'repository.url'], {
    cwd,
  })
    .then(({ stdout }) => stdout)
    .catch(() => '')
}

export { changelogUrlFor, nameToMarkdown, releaseUrlFor, repositoryUrlFor }
