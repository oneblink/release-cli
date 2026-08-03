import { describe, expect, it } from 'vitest'
import { ProductRepository } from '../src/enumerateProductRepositories.js'
import {
  buildDependencyBumpCommitMessage,
  getDependencyInstallSpecs,
  getDependentCandidates,
  getDownstreamRepositoryNames,
  getIntermediateNpmDependents,
  ScannedProductRepository,
} from '../src/updateDependentsPlanning.js'

const sdkCore = createProductRepository({
  label: '@oneblink/sdk-core (NPM package)',
  repositoryName: 'sdk-core-js',
  type: 'NPM',
  isPublic: true,
})

const appsReact = createProductRepository({
  label: '@oneblink/apps-react (NPM package)',
  repositoryName: 'apps-react',
  type: 'NPM',
  isPublic: true,
})

const formsRenderer = createProductRepository({
  label: 'Forms Renderer',
  repositoryName: 'product-forms-renderer',
  type: 'NODE_JS',
  isPublic: false,
})

const nugetSdk = createProductRepository({
  label: 'OneBlink.SDK (Nuget package)',
  repositoryName: 'sdk-dotnet',
  type: 'NUGET',
  isPublic: true,
  relativeProjectFile: 'OneBlink.SDK/OneBlink.SDK.csproj',
})

describe('getDependentCandidates', () => {
  it('returns repositories that depend on an outdated source package version', () => {
    const candidates = getDependentCandidates({
      scannedRepositories: [
        createScannedRepository({
          productRepository: appsReact,
          packageName: '@oneblink/apps-react',
          packageVersion: '11.0.0',
          dependencies: {
            '@oneblink/sdk-core': '^9.0.0',
          },
        }),
        createScannedRepository({
          productRepository: formsRenderer,
          packageName: 'forms-renderer',
          packageVersion: '2.0.0',
          dependencies: {
            '@oneblink/sdk-core': '^9.0.0',
            '@oneblink/apps-react': '^11.0.0',
          },
        }),
        createScannedRepository({
          productRepository: nugetSdk,
          supportsDependencyUpdates: false,
        }),
      ],
      dependency: '@oneblink/sdk-core',
      dependencyVersion: '10.1.0',
    })

    expect(candidates.map((candidate) => candidate.packageName)).toEqual([
      '@oneblink/apps-react',
      'forms-renderer',
    ])
  })

  it('skips repositories already on the expected dependency version', () => {
    const candidates = getDependentCandidates({
      scannedRepositories: [
        createScannedRepository({
          productRepository: appsReact,
          packageName: '@oneblink/apps-react',
          packageVersion: '11.0.0',
          dependencies: {
            '@oneblink/sdk-core': '^10.1.0',
          },
        }),
      ],
      dependency: '@oneblink/sdk-core',
      dependencyVersion: '10.1.0',
    })

    expect(candidates).toEqual([])
  })

  it('skips repositories that do not depend on the source package', () => {
    const candidates = getDependentCandidates({
      scannedRepositories: [
        createScannedRepository({
          productRepository: sdkCore,
          packageName: '@oneblink/sdk-core',
          packageVersion: '10.1.0',
          dependencies: {},
        }),
      ],
      dependency: '@oneblink/sdk-core',
      dependencyVersion: '10.1.0',
    })

    expect(candidates).toEqual([])
  })
})

describe('getIntermediateNpmDependents', () => {
  it('identifies NPM packages that other candidates also depend on', () => {
    const candidates = getDependentCandidates({
      scannedRepositories: [
        createScannedRepository({
          productRepository: appsReact,
          packageName: '@oneblink/apps-react',
          packageVersion: '11.0.0',
          dependencies: {
            '@oneblink/sdk-core': '^9.0.0',
          },
        }),
        createScannedRepository({
          productRepository: formsRenderer,
          packageName: 'forms-renderer',
          packageVersion: '2.0.0',
          dependencies: {
            '@oneblink/sdk-core': '^9.0.0',
            '@oneblink/apps-react': '^11.0.0',
          },
        }),
      ],
      dependency: '@oneblink/sdk-core',
      dependencyVersion: '10.1.0',
    })

    const intermediates = getIntermediateNpmDependents(candidates)

    expect(intermediates.map((candidate) => candidate.packageName)).toEqual([
      '@oneblink/apps-react',
    ])
  })

  it('does not treat NODE_JS repositories as intermediate NPM packages', () => {
    const candidates = getDependentCandidates({
      scannedRepositories: [
        createScannedRepository({
          productRepository: formsRenderer,
          packageName: 'forms-renderer',
          packageVersion: '2.0.0',
          dependencies: {
            '@oneblink/sdk-core': '^9.0.0',
          },
        }),
      ],
      dependency: '@oneblink/sdk-core',
      dependencyVersion: '10.1.0',
    })

    expect(getIntermediateNpmDependents(candidates)).toEqual([])
  })
})

describe('getDownstreamRepositoryNames', () => {
  it('returns repository names that depend on the intermediate package', () => {
    const candidates = getDependentCandidates({
      scannedRepositories: [
        createScannedRepository({
          productRepository: appsReact,
          packageName: '@oneblink/apps-react',
          packageVersion: '11.0.0',
          dependencies: {
            '@oneblink/sdk-core': '^9.0.0',
          },
        }),
        createScannedRepository({
          productRepository: formsRenderer,
          packageName: 'forms-renderer',
          packageVersion: '2.0.0',
          dependencies: {
            '@oneblink/sdk-core': '^9.0.0',
            '@oneblink/apps-react': '^11.0.0',
          },
        }),
      ],
      dependency: '@oneblink/sdk-core',
      dependencyVersion: '10.1.0',
    })
    const [intermediate] = getIntermediateNpmDependents(candidates)

    expect(
      getDownstreamRepositoryNames({
        candidates,
        intermediate,
      }),
    ).toEqual(['product-forms-renderer'])
  })
})

describe('getDependencyInstallSpecs', () => {
  it('returns install specs for outdated released packages that are already dependencies', () => {
    expect(
      getDependencyInstallSpecs({
        dependencies: {
          '@oneblink/sdk-core': '^9.0.0',
          '@oneblink/apps-react': '^11.0.0',
          lodash: '^4.0.0',
        },
        releasedPackageVersions: new Map([
          ['@oneblink/sdk-core', '10.1.0'],
          ['@oneblink/apps-react', '11.2.0'],
          ['@oneblink/storage', '7.1.0'],
        ]),
      }),
    ).toEqual({
      bumpedPackageNames: ['@oneblink/sdk-core', '@oneblink/apps-react'],
      installSpecs: [
        '@oneblink/sdk-core@10.1.0',
        '@oneblink/apps-react@11.2.0',
      ],
    })
  })

  it('skips packages already at the released version', () => {
    expect(
      getDependencyInstallSpecs({
        dependencies: {
          '@oneblink/sdk-core': '^10.1.0',
        },
        releasedPackageVersions: new Map([['@oneblink/sdk-core', '10.1.0']]),
      }),
    ).toEqual({
      bumpedPackageNames: [],
      installSpecs: [],
    })
  })
})

describe('buildDependencyBumpCommitMessage', () => {
  it('includes bumped package names', () => {
    expect(
      buildDependencyBumpCommitMessage({
        ticket: 'ON-1234',
        bumpedPackageNames: ['@oneblink/sdk-core', '@oneblink/apps-react'],
        isUpdatingTypes: false,
      }),
    ).toBe('ON-1234 # Bumped @oneblink/sdk-core, @oneblink/apps-react')
  })

  it('appends @oneblink/types when types are being updated', () => {
    expect(
      buildDependencyBumpCommitMessage({
        ticket: 'ON-1234',
        bumpedPackageNames: ['@oneblink/sdk-core'],
        isUpdatingTypes: true,
      }),
    ).toBe('ON-1234 # Bumped @oneblink/sdk-core, @oneblink/types')
  })
})

function createProductRepository(
  productRepository: ProductRepository,
): ProductRepository {
  return productRepository
}

function createScannedRepository({
  productRepository,
  packageName,
  packageVersion,
  dependencies = {},
  supportsDependencyUpdates = true,
}: {
  productRepository: ProductRepository
  packageName?: string
  packageVersion?: string
  dependencies?: Record<string, string | undefined>
  supportsDependencyUpdates?: boolean
}): ScannedProductRepository {
  return {
    productRepository,
    packageName,
    packageVersion,
    dependencies,
    supportsDependencyUpdates,
  }
}
