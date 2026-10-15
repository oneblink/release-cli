import path from 'path'
import prepareCloneRepository from './prepareCloneRepository.js'
import { RepositoryType } from './repositories-plugins/plugins-factory.js'
import { SourceCodeProviderConfig } from './source-code-providers/createSourceCodeProvider.js'
import createSourceCodeProvider from './source-code-providers/createSourceCodeProvider.js'
import { SourceCodeProvider } from './source-code-providers/SourceCodeProvider.js'

const GITHUB_PRODUCT_REPOSITORY_OWNER = 'oneblink'

type GitHubProductRepositoryInput = {
  label: string
  repositoryName: string
  isPublic: boolean
} & RepositoryType

export type ProductRepository = {
  sourceCodeProvider: SourceCodeProviderConfig
} & GitHubProductRepositoryInput

export function createGitHubProductRepository(
  config: GitHubProductRepositoryInput,
): ProductRepository {
  const { repositoryName } = config

  return {
    ...config,
    sourceCodeProvider: {
      type: 'GITHUB',
      owner: GITHUB_PRODUCT_REPOSITORY_OWNER,
      repositoryName,
    },
  }
}

export function getProductRepositorySourceCodeProvider(
  productRepository: ProductRepository,
): SourceCodeProvider {
  return createSourceCodeProvider(productRepository.sourceCodeProvider)
}

export function getProductRepository(
  repositoryName: string,
): ProductRepository | undefined {
  return productRepositories.find(
    (productRepository) => productRepository.repositoryName === repositoryName,
  )
}

export const productRepositories: readonly ProductRepository[] = [
  createGitHubProductRepository({
    label: '@oneblink/apps-react (NPM package)',
    repositoryName: 'apps-react',
    type: 'NPM',
    isPublic: true,
  }),
  createGitHubProductRepository({
    label: '@oneblink/cli (NPM package)',
    repositoryName: 'cli',
    isPublic: true,
    type: 'NPM',
  }),
  createGitHubProductRepository({
    label: 'Embedded Forms Script',
    repositoryName: 'forms-cdn',
    isPublic: true,
    type: 'CDN_HOSTING',
  }),
  createGitHubProductRepository({
    label: 'API',
    repositoryName: 'product-api',
    isPublic: false,
    type: 'NODE_JS',
  }),
  createGitHubProductRepository({
    label: 'Approvals API',
    repositoryName: 'product-approvals-api',
    isPublic: false,
    type: 'NODE_JS',
  }),
  createGitHubProductRepository({
    label: 'Approvals Client',
    repositoryName: 'product-approvals-client',
    isPublic: false,
    type: 'NODE_JS',
  }),
  createGitHubProductRepository({
    label: 'Console',
    repositoryName: 'product-console',
    isPublic: false,
    type: 'NODE_JS',
  }),
  createGitHubProductRepository({
    label: 'Data Manager Client',
    repositoryName: 'product-form-store-client',
    isPublic: false,
    type: 'NODE_JS',
  }),
  createGitHubProductRepository({
    label: 'Lambda@Edge Functions',
    repositoryName: 'product-forms-lambda-at-edge-authorisation',
    isPublic: false,
    type: 'NODE_JS',
  }),
  createGitHubProductRepository({
    label: 'Forms Renderer',
    repositoryName: 'product-forms-renderer',
    isPublic: false,
    type: 'NODE_JS',
  }),
  createGitHubProductRepository({
    label: 'Infrastructure',
    repositoryName: 'product-infrastructure',
    isPublic: false,
    type: 'NODE_JS',
  }),
  createGitHubProductRepository({
    label: 'PDF Service',
    repositoryName: 'product-pdf',
    isPublic: false,
    type: 'NODE_JS',
  }),
  createGitHubProductRepository({
    label: 'S3 Submission Events Lambda(s)',
    repositoryName: 'product-s3-submission-events',
    isPublic: false,
    type: 'NODE_JS',
  }),
  createGitHubProductRepository({
    label: 'S3 Object Lambda',
    repositoryName: 'product-s3-object-lambda',
    isPublic: false,
    type: 'NODE_JS',
  }),
  createGitHubProductRepository({
    label: 'Built-in Data Sources',
    repositoryName: 'built-in-data-sources',
    isPublic: false,
    type: 'NODE_JS',
  }),
  createGitHubProductRepository({
    label: '@oneblink/storage (NPM package)',
    repositoryName: 'storage',
    isPublic: true,
    type: 'NPM',
  }),
  createGitHubProductRepository({
    label: '@oneblink/sdk-core (NPM package)',
    repositoryName: 'sdk-core-js',
    isPublic: true,
    type: 'NPM',
  }),
  createGitHubProductRepository({
    label: 'OneBlink.SDK (Nuget package)',
    repositoryName: 'sdk-dotnet',
    isPublic: true,
    type: 'NUGET',
    relativeProjectFile: path.join('OneBlink.SDK', 'OneBlink.SDK.csproj'),
  }),
  createGitHubProductRepository({
    label: '@oneblink/sdk (NPM package)',
    repositoryName: 'sdk-node-js',
    isPublic: true,
    type: 'NPM',
  }),
  {
    label: 'Drupal OneBlink Form Embed',
    repositoryName: 'oneblink_form_embed',
    isPublic: true,
    type: 'DRUPAL_MODULE',
    relativeInfoFile: 'oneblink_form_embed.info.yml',
    sourceCodeProvider: {
      type: 'DRUPAL_GIT',
      projectName: 'oneblink_form_embed',
    },
  },
]

export default async function enumerateProductRepositories(
  fn: (options: {
    cloneUrl: string
    repositoryWorkingDirectory: string
    productRepository: ProductRepository
    sourceCodeProvider: SourceCodeProvider
  }) => Promise<void>,
) {
  for (const productRepository of productRepositories) {
    const { repositoryName } = productRepository
    const sourceCodeProvider =
      getProductRepositorySourceCodeProvider(productRepository)

    const {
      cloneRepository,
      repositoryWorkingDirectory,
      removeRepositoryWorkingDirectory,
    } = await prepareCloneRepository({
      repositoryName,
      cloneUrl: sourceCodeProvider.cloneUrl,
    })

    try {
      const cloneUrl = await cloneRepository()
      await fn({
        cloneUrl,
        repositoryWorkingDirectory,
        productRepository,
        sourceCodeProvider,
      })
    } finally {
      await removeRepositoryWorkingDirectory()
    }
  }
}
