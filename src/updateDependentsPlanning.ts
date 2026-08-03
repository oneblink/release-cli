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

export function getIntermediateNpmDependents(
  candidates: DependentCandidate[],
): DependentCandidate[] {
  return candidates.filter((candidate) => {
    if (candidate.productRepository.type !== 'NPM') {
      return false
    }

    return candidates.some(
      (otherCandidate) =>
        otherCandidate.productRepository.repositoryName !==
          candidate.productRepository.repositoryName &&
        !!otherCandidate.dependencies[candidate.packageName],
    )
  })
}

export function getDownstreamRepositoryNames({
  candidates,
  intermediate,
}: {
  candidates: DependentCandidate[]
  intermediate: DependentCandidate
}): string[] {
  return candidates
    .filter(
      (candidate) =>
        candidate.productRepository.repositoryName !==
          intermediate.productRepository.repositoryName &&
        candidate.dependencies[intermediate.packageName],
    )
    .map((candidate) => candidate.productRepository.repositoryName)
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
