import { SemVer } from 'semver'
import NpmPlugin from './NpmPlugin.js'
import { RepositoryPlugin } from './RepositoryPlugin.js'

export default class NodeJsPlugin
  extends NpmPlugin
  implements RepositoryPlugin
{
  displayType = 'NodeJS'
  isDeploymentRequired = true

  async autoIncrementVersion(
    currentSemverVersion: SemVer,
  ): Promise<string | undefined> {
    // NodeJS repositories that are not being published to NPM
    // don't need to follow semantic versioning as no user ever
    // gets the option to choose a version. We will simply increment
    // the existing version by a minor version.
    return currentSemverVersion.inc('minor').version
  }
}
