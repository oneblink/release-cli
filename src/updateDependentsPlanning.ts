import { ProductRepository } from './enumerateProductRepositories.js'

export type ScannedProductRepository = {
  productRepository: ProductRepository
  packageName: string | undefined
  packageVersion: string | undefined
  dependencies: Record<string, string | undefined>
  supportsDependencyUpdates: boolean
}

export type DependentCandidate = {
  productRepository: ProductRepository
  packageName: string
  packageVersion: string
  dependencies: Record<string, string | undefined>
  currentSourceDependencyVersion: string
}

export function getDependentCandidates({
  scannedRepositories,
  dependency,
  dependencyVersion,
}: {
  scannedRepositories: ScannedProductRepository[]
  dependency: string
  dependencyVersion: string
}): DependentCandidate[] {
  const expectedDependencyVersion = `^${dependencyVersion}`
  const candidates: DependentCandidate[] = []

  for (const scannedRepository of scannedRepositories) {
    if (!scannedRepository.supportsDependencyUpdates) {
      continue
    }

    const currentDependencyVersion = scannedRepository.dependencies[dependency]
    if (!currentDependencyVersion) {
      continue
    }
    if (currentDependencyVersion === expectedDependencyVersion) {
      continue
    }
    if (!scannedRepository.packageName || !scannedRepository.packageVersion) {
      continue
    }

    candidates.push({
      productRepository: scannedRepository.productRepository,
      packageName: scannedRepository.packageName,
      packageVersion: scannedRepository.packageVersion,
      dependencies: scannedRepository.dependencies,
      currentSourceDependencyVersion: currentDependencyVersion,
    })
  }

  return candidates
}

export function getIntermediateNpmDependents({
  candidates,
  scannedRepositories,
}: {
  candidates: DependentCandidate[]
  scannedRepositories: ScannedProductRepository[]
}): DependentCandidate[] {
  return candidates.filter((candidate) => {
    if (candidate.productRepository.type !== 'NPM') {
      return false
    }

    return scannedRepositories.some(
      (scannedRepository) =>
        scannedRepository.productRepository.repositoryName !==
          candidate.productRepository.repositoryName &&
        !!scannedRepository.dependencies[candidate.packageName],
    )
  })
}

export function getDownstreamRepositoryNames({
  scannedRepositories,
  intermediate,
}: {
  scannedRepositories: ScannedProductRepository[]
  intermediate: DependentCandidate
}): string[] {
  return scannedRepositories
    .filter(
      (scannedRepository) =>
        scannedRepository.productRepository.repositoryName !==
          intermediate.productRepository.repositoryName &&
        !!scannedRepository.dependencies[intermediate.packageName],
    )
    .map(
      (scannedRepository) =>
        scannedRepository.productRepository.repositoryName,
    )
}

export function getRepositoriesNeedingDependencyUpdates({
  scannedRepositories,
  releasedPackageVersions,
  excludeRepositoryNames,
}: {
  scannedRepositories: ScannedProductRepository[]
  releasedPackageVersions: Map<string, string>
  excludeRepositoryNames?: Set<string>
}): DependentCandidate[] {
  const candidatesByRepositoryName = new Map<string, DependentCandidate>()

  for (const [packageName, version] of releasedPackageVersions) {
    for (const candidate of getDependentCandidates({
      scannedRepositories,
      dependency: packageName,
      dependencyVersion: version,
    })) {
      const repositoryName = candidate.productRepository.repositoryName
      if (excludeRepositoryNames?.has(repositoryName)) {
        continue
      }
      if (!candidatesByRepositoryName.has(repositoryName)) {
        candidatesByRepositoryName.set(repositoryName, candidate)
      }
    }
  }

  return [...candidatesByRepositoryName.values()]
}

export function getDependencyInstallSpecs({
  dependencies,
  releasedPackageVersions,
}: {
  dependencies: Record<string, string | undefined>
  releasedPackageVersions: Map<string, string>
}): {
  bumpedPackageNames: string[]
  installSpecs: string[]
} {
  const bumpedPackageNames: string[] = []
  const installSpecs: string[] = []

  for (const [packageName, version] of releasedPackageVersions) {
    const currentVersion = dependencies[packageName]
    if (currentVersion && currentVersion !== `^${version}`) {
      installSpecs.push(`${packageName}@${version}`)
      bumpedPackageNames.push(packageName)
    }
  }

  return {
    bumpedPackageNames,
    installSpecs,
  }
}

export function buildDependencyBumpCommitMessage({
  ticket,
  bumpedPackageNames,
  isUpdatingTypes,
}: {
  ticket: string
  bumpedPackageNames: string[]
  isUpdatingTypes: boolean
}): string {
  const commitPackageNames = [...bumpedPackageNames]
  if (isUpdatingTypes) {
    commitPackageNames.push('@oneblink/types')
  }

  return `${ticket} # Bumped ${commitPackageNames.join(', ')}`
}
