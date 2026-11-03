import { describe, expect, it } from 'vitest'
import {
  createGitHubProductRepository,
  ProductRepository,
} from '../src/enumerateProductRepositories.js'
import {
  buildDependencyBumpCommitMessage,
  collectTrackedDependencies,
  getDependencyInstallSpecs,
  getDependentCandidates,
  getDownstreamRepositoryNames,
  getIntermediateNpmDependents,
  getRepositoriesNeedingDependencyUpdates,
  ScannedProductRepository,
} from '../src/updateDependentsPlanning.js'

const sdkCore = createProductRepository(
  createGitHubProductRepository({
    label: '@oneblink/sdk-core (NPM package)',
    repositoryName: 'sdk-core-js',
    type: 'NPM',
    isPublic: true,
  }),
)

const appsReact = createProductRepository(
  createGitHubProductRepository({
    label: '@oneblink/apps-react (NPM package)',
    repositoryName: 'apps-react',
    type: 'NPM',
    isPublic: true,
  }),
)

const formsRenderer = createProductRepository(
  createGitHubProductRepository({
    label: 'Forms Renderer',
    repositoryName: 'product-forms-renderer',
    type: 'NODE_JS',
    isPublic: false,
  }),
)

const formsCdn = createProductRepository(
  createGitHubProductRepository({
    label: 'Embedded Forms Script',
    repositoryName: 'forms-cdn',
    type: 'CDN_HOSTING',
    isPublic: true,
  }),
)

const nugetSdk = createProductRepository(
  createGitHubProductRepository({
    label: 'OneBlink.SDK (Nuget package)',
    repositoryName: 'sdk-dotnet',
    type: 'NUGET',
    isPublic: true,
    relativeProjectFile: 'OneBlink.SDK/OneBlink.SDK.csproj',
  }),
)

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
  it('identifies NPM packages that other scanned repositories also depend on', () => {
    const scannedRepositories = [
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
        productRepository: formsCdn,
        packageName: 'forms-cdn',
        packageVersion: '1.0.0',
        dependencies: {
          '@oneblink/apps-react': '^11.0.0',
        },
      }),
    ]
    const candidates = getDependentCandidates({
      scannedRepositories,
      dependency: '@oneblink/sdk-core',
      dependencyVersion: '10.1.0',
    })

    const intermediates = getIntermediateNpmDependents({
      candidates,
      scannedRepositories,
    })

    expect(intermediates.map((candidate) => candidate.packageName)).toEqual([
      '@oneblink/apps-react',
    ])
  })

  it('treats an NPM candidate as intermediate when only non-source dependents use it', () => {
    const scannedRepositories = [
      createScannedRepository({
        productRepository: appsReact,
        packageName: '@oneblink/apps-react',
        packageVersion: '11.0.0',
        dependencies: {
          '@oneblink/sdk-core': '^9.0.0',
        },
      }),
      createScannedRepository({
        productRepository: formsCdn,
        packageName: 'forms-cdn',
        packageVersion: '1.0.0',
        dependencies: {
          '@oneblink/apps-react': '^11.0.0',
        },
      }),
    ]
    const candidates = getDependentCandidates({
      scannedRepositories,
      dependency: '@oneblink/sdk-core',
      dependencyVersion: '10.1.0',
    })

    expect(
      getIntermediateNpmDependents({
        candidates,
        scannedRepositories,
      }).map((candidate) => candidate.packageName),
    ).toEqual(['@oneblink/apps-react'])
  })

  it('does not treat NODE_JS repositories as intermediate NPM packages', () => {
    const scannedRepositories = [
      createScannedRepository({
        productRepository: formsRenderer,
        packageName: 'forms-renderer',
        packageVersion: '2.0.0',
        dependencies: {
          '@oneblink/sdk-core': '^9.0.0',
        },
      }),
    ]
    const candidates = getDependentCandidates({
      scannedRepositories,
      dependency: '@oneblink/sdk-core',
      dependencyVersion: '10.1.0',
    })

    expect(
      getIntermediateNpmDependents({
        candidates,
        scannedRepositories,
      }),
    ).toEqual([])
  })
})

describe('getDownstreamRepositoryNames', () => {
  it('includes repositories that depend on the intermediate even without the source package', () => {
    const scannedRepositories = [
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
        productRepository: formsCdn,
        packageName: 'forms-cdn',
        packageVersion: '1.0.0',
        dependencies: {
          '@oneblink/apps-react': '^11.0.0',
        },
      }),
    ]
    const candidates = getDependentCandidates({
      scannedRepositories,
      dependency: '@oneblink/sdk-core',
      dependencyVersion: '10.1.0',
    })
    const [intermediate] = getIntermediateNpmDependents({
      candidates,
      scannedRepositories,
    })

    expect(
      getDownstreamRepositoryNames({
        scannedRepositories,
        intermediate,
      }),
    ).toEqual(['product-forms-renderer', 'forms-cdn'])
  })
})

describe('getRepositoriesNeedingDependencyUpdates', () => {
  it('includes repositories that only depend on a released intermediate package', () => {
    const scannedRepositories = [
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
        productRepository: formsCdn,
        packageName: 'forms-cdn',
        packageVersion: '1.0.0',
        dependencies: {
          '@oneblink/apps-react': '^11.0.0',
        },
      }),
    ]

    expect(
      getRepositoriesNeedingDependencyUpdates({
        scannedRepositories,
        releasedPackageVersions: new Map([
          ['@oneblink/sdk-core', '10.1.0'],
          ['@oneblink/apps-react', '11.2.0'],
        ]),
        excludeRepositoryNames: new Set(['apps-react']),
      }).map((candidate) => candidate.productRepository.repositoryName),
    ).toEqual(['product-forms-renderer', 'forms-cdn'])
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
      devInstallSpecs: [],
    })
  })

  it('returns dev install specs for packages tracked as dev dependencies', () => {
    expect(
      getDependencyInstallSpecs({
        dependencies: {
          '@oneblink/sdk-core': '^9.0.0',
          '@oneblink/types': '^8.0.0',
        },
        devDependencyNames: ['@oneblink/types'],
        releasedPackageVersions: new Map([
          ['@oneblink/sdk-core', '10.1.0'],
          ['@oneblink/types', '8.2.0'],
        ]),
      }),
    ).toEqual({
      bumpedPackageNames: ['@oneblink/sdk-core', '@oneblink/types'],
      installSpecs: ['@oneblink/sdk-core@10.1.0'],
      devInstallSpecs: ['@oneblink/types@8.2.0'],
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
      devInstallSpecs: [],
    })
  })
})

describe('collectTrackedDependencies', () => {
  it('ignores dev dependencies unless they are included', () => {
    expect(
      collectTrackedDependencies({
        dependencies: {
          '@oneblink/sdk-core': '^9.0.0',
        },
        devDependencies: {
          '@oneblink/types': '^8.0.0',
        },
        includeDevDependencies: false,
      }),
    ).toEqual({
      dependencies: {
        '@oneblink/sdk-core': '^9.0.0',
      },
      devDependencyNames: [],
    })
  })

  it('tracks dev dependencies and keeps production dependencies ahead of them', () => {
    expect(
      collectTrackedDependencies({
        dependencies: {
          '@oneblink/sdk-core': '^9.0.0',
        },
        devDependencies: {
          '@oneblink/sdk-core': '^8.0.0',
          '@oneblink/types': '^8.0.0',
        },
        includeDevDependencies: true,
      }),
    ).toEqual({
      dependencies: {
        '@oneblink/sdk-core': '^9.0.0',
        '@oneblink/types': '^8.0.0',
      },
      devDependencyNames: ['@oneblink/types'],
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
  devDependencyNames = [],
  supportsDependencyUpdates = true,
}: {
  productRepository: ProductRepository
  packageName?: string
  packageVersion?: string
  dependencies?: Record<string, string | undefined>
  devDependencyNames?: string[]
  supportsDependencyUpdates?: boolean
}): ScannedProductRepository {
  return {
    productRepository,
    packageName,
    packageVersion,
    dependencies,
    devDependencyNames,
    supportsDependencyUpdates,
  }
}
