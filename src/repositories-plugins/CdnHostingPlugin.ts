import NpmPlugin from './NpmPlugin.js'
import { RepositoryPlugin } from './RepositoryPlugin.js'

export default class CdnHostingPlugin
  extends NpmPlugin
  implements RepositoryPlugin
{
  displayType = 'CDN Hosting'
  isDeploymentRequired = true
}
