import path from 'path'
import prepareCloneRepository from './prepareCloneRepository.js'
import { RepositoryType } from './repositories-plugins/plugins-factory.js'

type Repository = {
  label: string
  repositoryName: string
  isPublic: boolean
} & RepositoryType

const productRepositories: Repository[] = [
  {
    label: '@oneblink/apps-react (NPM package)',
    repositoryName: 'apps-react',
    type: 'NPM',
    isPublic: true,
  },
  {
    label: '@oneblink/cli (NPM package)',
    repositoryName: 'cli',
    isPublic: true,
    type: 'NPM',
  },
  {
    label: 'Embedded Forms Script',
    repositoryName: 'forms-cdn',
    isPublic: true,
    type: 'CDN_HOSTING',
  },
  {
    label: 'API',
    repositoryName: 'product-api',
    isPublic: false,
    type: 'NODE_JS',
  },
  {
    label: 'Approvals API',
    repositoryName: 'product-approvals-api',
    isPublic: false,
    type: 'NODE_JS',
  },
  {
    label: 'Approvals Client',
    repositoryName: 'product-approvals-client',
    isPublic: false,
    type: 'NODE_JS',
  },
  {
    label: 'Cognito Hosted Login CSS',
    repositoryName: 'product-cognito-hosted-login-css',
    isPublic: false,
    type: 'NODE_JS',
  },
  {
    label: 'Console',
    repositoryName: 'product-console',
    isPublic: false,
    type: 'NODE_JS',
  },
  {
    label: 'Data Manager Client',
    repositoryName: 'product-form-store-client',
    isPublic: false,
    type: 'NODE_JS',
  },
  {
    label: 'Lambda@Edge Functions',
    repositoryName: 'product-forms-lambda-at-edge-authorisation',
    isPublic: false,
    type: 'NODE_JS',
  },
  {
    label: 'Forms Renderer',
    repositoryName: 'product-forms-renderer',
    isPublic: false,
    type: 'NODE_JS',
  },
  {
    label: 'Infrastructure',
    repositoryName: 'product-infrastructure',
    isPublic: false,
    type: 'NODE_JS',
  },
  {
    label: 'PDF Service',
    repositoryName: 'product-pdf',
    isPublic: false,
    type: 'NODE_JS',
  },
  {
    label: 'S3 Submission Events Lambda(s)',
    repositoryName: 'product-s3-submission-events',
    isPublic: false,
    type: 'NODE_JS',
  },
  {
    label: 'S3 Object Lambda',
    repositoryName: 'product-s3-object-lambda',
    isPublic: false,
    type: 'NODE_JS',
  },
  {
    label: 'Built-in Data Sources',
    repositoryName: 'built-in-data-sources',
    isPublic: false,
    type: 'NODE_JS',
  },
  {
    label: '@oneblink/storage (NPM package)',
    repositoryName: 'storage',
    isPublic: true,
    type: 'NPM',
  },
  {
    label: '@oneblink/sdk-core (NPM package)',
    repositoryName: 'sdk-core-js',
    isPublic: true,
    type: 'NPM',
  },
  {
    label: 'OneBlink.SDK (Nuget package)',
    repositoryName: 'sdk-dotnet',
    isPublic: true,
    type: 'NUGET',
    relativeProjectFile: path.join('OneBlink.SDK', 'OneBlink.SDK.csproj'),
  },
  {
    label: '@oneblink/sdk (NPM package)',
    repositoryName: 'sdk-node-js',
    isPublic: true,
    type: 'NPM',
  },
]

export default async function enumerateProductRepositories(
  fn: (options: {
    cloneUrl: string
    repositoryWorkingDirectory: string
    productRepository: Repository
  }) => Promise<void>,
) {
  for (const productRepository of productRepositories) {
    const { repositoryName } = productRepository

    const {
      cloneRepository,
      repositoryWorkingDirectory,
      removeRepositoryWorkingDirectory,
    } = await prepareCloneRepository({
      repositoryName,
    })

    try {
      const cloneUrl = await cloneRepository()
      await fn({
        cloneUrl,
        repositoryWorkingDirectory,
        productRepository,
      })
    } finally {
      await removeRepositoryWorkingDirectory()
    }
  }
}
