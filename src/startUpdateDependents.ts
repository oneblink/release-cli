import { readPackageUp } from 'read-package-up'
import {
  productRepositories,
  ProductRepository,
} from './enumerateProductRepositories.js'
import getRepositoryPlugin from './repositories-plugins/plugins-factory.js'
import enquirer from 'enquirer'
import executeCommand from './executeCommand.js'
import boxen from 'boxen'
import chalk from 'chalk'
import prepareCloneRepository from './prepareCloneRepository.js'
import topologicallySortByPackageDependencies from './topologicallySortByPackageDependencies.js'
import waitForNpmPackageVersion from './waitForNpmPackageVersion.js'
import promptForNextVersion from './promptForNextVersion.js'
import promptForReleaseName from './promptForReleaseName.js'
import startRepositoryRelease from './startRepositoryRelease.js'
import getPreRelease from './getPreRelease.js'
import semver from 'semver'
import {
  buildDependencyBumpCommitMessage,
  DependentCandidate,
  getDependencyInstallSpecs,
  getDependentCandidates,
  getDownstreamRepositoryNames,
  getIntermediateNpmDependents,
  getRepositoriesNeedingDependencyUpdates,
  ScannedProductRepository,
} from './updateDependentsPlanning.js'
import createOrLinkPullRequest, {
  createPullRequestOctokit,
} from './createOrLinkPullRequest.js'
import resolveTicket from './resolveTicket.js'

type RetainedClone = {
  repositoryWorkingDirectory: string
  removeRepositoryWorkingDirectory: () => Promise<void>
}

export default async function startUpdateDependents({
  cwd,
  force = false,
  forceUpdateDependency = false,
  forcePublishIntermediateDependency = false,
  ticket: ticketFlag,
}: {
  cwd: string
  force?: boolean
  forceUpdateDependency?: boolean
  forcePublishIntermediateDependency?: boolean
  ticket?: string
}) {
  const shouldForceUpdateDependency = force || forceUpdateDependency
  const shouldForcePublishIntermediateDependency =
    force || forcePublishIntermediateDependency

  const dependencyRepositoryPlugin = await getRepositoryPlugin({
    cwd,
  })
  if (!dependencyRepositoryPlugin.supportsDependencyUpdates) {
    console.log(
      `"${dependencyRepositoryPlugin.displayType}" repositories do not support updating dependencies.`,
    )
    return
  }

  const dependencyResult = await readPackageUp({
    cwd,
  })
  if (!dependencyResult) {
    return
  }

  const dependency = dependencyResult.packageJson.name
  const dependencyVersion = dependencyResult.packageJson.version
  console.log('Beginning to update the dependents of:', dependency)

  const ticket = await resolveTicket({
    ticketFlag,
    force,
  })

  const isUpdatingTypes = await resolveIsUpdatingTypes({
    force,
  })

  const retainedClones = new Map<string, RetainedClone>()

  try {
    const { scannedRepositories } = await scanProductRepositories({
      retainedClones,
    })

    const candidates = getDependentCandidates({
      scannedRepositories,
      dependency,
      dependencyVersion,
    })

    for (const scannedRepository of scannedRepositories) {
      logSkippedRepository({
        scannedRepository,
        dependency,
        dependencyVersion,
        candidates,
      })
    }

    if (!candidates.length) {
      console.log(`No product repositories need "${dependency}" updated.`)
      return
    }

    const intermediates = getIntermediateNpmDependents({
      candidates,
      scannedRepositories,
    })
    const sortedIntermediates =
      topologicallySortByPackageDependencies(intermediates)

    await pruneRetainedClones({
      retainedClones,
      repositoryNamesToRetain: getRepositoryNamesToRetain({
        candidates,
        intermediates,
        scannedRepositories,
      }),
    })

    const releasedPackageVersions = new Map<string, string>([
      [dependency, dependencyVersion],
    ])
    const releasedRepositoryNames = new Set<string>()
    const releasedPackageSummaries: string[] = []
    const pullRequestUrls: string[] = []
    let createdAnyPullRequest = false
    const octokit = createPullRequestOctokit()

    for (const intermediate of sortedIntermediates) {
      const downstreamRepositoryNames = getDownstreamRepositoryNames({
        scannedRepositories,
        intermediate,
      })

      let shouldRelease: 'yes' | 'no'
      if (shouldForcePublishIntermediateDependency) {
        shouldRelease = 'yes'
        console.log(
          `Auto-releasing "${intermediate.packageName}" because it is depended on by: ${downstreamRepositoryNames.join(', ')}`,
        )
      } else {
        const releaseResult = await enquirer.prompt<{
          shouldRelease: 'yes' | 'no'
        }>({
          type: 'select',
          name: 'shouldRelease',
          message: `"${intermediate.productRepository.repositoryName}" (${intermediate.packageName}) also needs a release because it is depended on by: ${downstreamRepositoryNames.join(', ')}. Update "${dependency}" and release "${intermediate.packageName}" now so downstream pull requests can include both version bumps?`,
          choices: [
            {
              message: `Yes, update and release "${intermediate.packageName}"`,
              name: 'yes',
            },
            {
              message: `No, only open a dependency bump pull request for "${intermediate.productRepository.repositoryName}"`,
              name: 'no',
            },
          ],
        })
        shouldRelease = releaseResult.shouldRelease
      }

      if (shouldRelease === 'no') {
        console.log(
          chalk.yellow(
            `Skipping release of "${intermediate.packageName}". Downstream pull requests may conflict later when "${intermediate.packageName}" is released and dependents are updated again.`,
          ),
        )
        continue
      }

      const repositoryWorkingDirectory = getRetainedWorkingDirectory({
        retainedClones,
        repositoryName: intermediate.productRepository.repositoryName,
      })

      const bumpedPackageNames = await installDependencyUpdates({
        cwd: repositoryWorkingDirectory,
        dependencies: intermediate.dependencies,
        releasedPackageVersions,
        isUpdatingTypes: isUpdatingTypes === 'yes',
      })

      if (!bumpedPackageNames.length && isUpdatingTypes !== 'yes') {
        console.log(
          `Skipping release of "${intermediate.packageName}" as there were no dependency updates to apply.`,
        )
        continue
      }

      await commitDependencyUpdates({
        cwd: repositoryWorkingDirectory,
        ticket,
        bumpedPackageNames,
        isUpdatingTypes: isUpdatingTypes === 'yes',
      })

      const repositoryPlugin = await getRepositoryPlugin({
        cwd: repositoryWorkingDirectory,
        repositoryType: intermediate.productRepository,
      })
      const nextVersion = await resolveNextVersion({
        repositoryPlugin,
        force,
      })
      const preRelease = getPreRelease(nextVersion)
      const releaseName =
        force || intermediate.productRepository.isPublic || preRelease
          ? undefined
          : await promptForReleaseName()

      await startRepositoryRelease({
        nextVersion,
        git: true,
        releaseName,
        repositoryPlugin,
      })

      await waitForNpmPackageVersion({
        packageName: intermediate.packageName,
        version: nextVersion,
      })

      releasedPackageVersions.set(intermediate.packageName, nextVersion)
      releasedRepositoryNames.add(intermediate.productRepository.repositoryName)
      releasedPackageSummaries.push(
        `${intermediate.packageName}@${nextVersion}`,
      )
    }

    const updateTargets = getRepositoriesNeedingDependencyUpdates({
      scannedRepositories,
      releasedPackageVersions,
      excludeRepositoryNames: releasedRepositoryNames,
    })

    for (const candidate of updateTargets) {
      const { bumpedPackageNames: packagesToUpdate } = getDependencyInstallSpecs(
        {
          dependencies: candidate.dependencies,
          releasedPackageVersions,
        },
      )

      let isUpdating: 'yes' | 'no'
      if (shouldForceUpdateDependency) {
        isUpdating = 'yes'
        console.log(
          `Auto-updating ${packagesToUpdate.join(', ')} in "${candidate.productRepository.repositoryName}"`,
        )
      } else {
        const updateResult = await enquirer.prompt<{
          isUpdating: 'yes' | 'no'
        }>({
          type: 'select',
          name: 'isUpdating',
          message: `Would you like to update ${packagesToUpdate.join(', ')} in "${candidate.productRepository.repositoryName}"?`,
          choices: [
            {
              message: 'Yes, update dependency!',
              name: 'yes',
            },
            {
              message: `No! "${candidate.productRepository.repositoryName}" does not need to be updated.`,
              name: 'no',
            },
          ],
        })
        isUpdating = updateResult.isUpdating
      }
      if (isUpdating === 'no') {
        continue
      }

      const repositoryWorkingDirectory = await ensureRetainedWorkingDirectory({
        retainedClones,
        repositoryName: candidate.productRepository.repositoryName,
      })

      await executeCommand(
        'git',
        ['checkout', '-b', ticket],
        repositoryWorkingDirectory,
      )

      const bumpedPackageNames = await installDependencyUpdates({
        cwd: repositoryWorkingDirectory,
        dependencies: candidate.dependencies,
        releasedPackageVersions,
        isUpdatingTypes: isUpdatingTypes === 'yes',
      })

      if (!bumpedPackageNames.length && isUpdatingTypes !== 'yes') {
        console.log(
          `Skipping "${candidate.productRepository.repositoryName}" as there were no dependency updates to apply.`,
        )
        continue
      }

      const commitMessage = buildDependencyBumpCommitMessage({
        ticket,
        bumpedPackageNames,
        isUpdatingTypes: isUpdatingTypes === 'yes',
      })
      await commitDependencyUpdates({
        cwd: repositoryWorkingDirectory,
        ticket,
        bumpedPackageNames,
        isUpdatingTypes: isUpdatingTypes === 'yes',
      })
      await executeCommand(
        'git',
        ['push', '-u', 'origin', ticket],
        repositoryWorkingDirectory,
      )
      const pullRequest = await createOrLinkPullRequest({
        octokit,
        repositoryName: candidate.productRepository.repositoryName,
        ticket,
        title: commitMessage,
      })
      pullRequestUrls.push(pullRequest.url)
      if (pullRequest.created) {
        createdAnyPullRequest = true
      }
    }

    if (releasedPackageSummaries.length) {
      console.log(
        boxen(
          `The following NPM packages were released during this run:

  ${releasedPackageSummaries.join(`
  `)}`,
          {
            padding: 1,
          },
        ),
      )
    }

    if (pullRequestUrls.length) {
      const pullRequestHeading = createdAnyPullRequest
        ? 'The following Pull Requests were created:'
        : 'The following Pull Requests can be created:'
      console.log(
        boxen(
          `${pullRequestHeading}

  ${pullRequestUrls.join(`
  `)}`,
          {
            padding: 1,
          },
        ),
      )
    }
  } finally {
    await removeRetainedClones(retainedClones)
  }
}

async function resolveIsUpdatingTypes({
  force,
}: {
  force: boolean
}): Promise<'yes' | 'no'> {
  if (force) {
    console.log(
      'Skipping "@oneblink/types" update because "--force" was provided.',
    )
    return 'no'
  }

  const { isUpdatingTypes } = await enquirer.prompt<{
    isUpdatingTypes: 'yes' | 'no'
  }>({
    type: 'select',
    name: 'isUpdatingTypes',
    message: `Would you like to update "@oneblink/types" as well?`,
    choices: [
      {
        message: 'Yes, update @oneblink/types',
        name: 'yes',
      },
      {
        message: 'No! "@oneblink/types" does not need to be updated.',
        name: 'no',
      },
    ],
  })

  return isUpdatingTypes
}

async function resolveNextVersion({
  repositoryPlugin,
  force,
}: {
  repositoryPlugin: Awaited<ReturnType<typeof getRepositoryPlugin>>
  force: boolean
}): Promise<string> {
  if (!force) {
    const { nextVersion } = await promptForNextVersion({
      repositoryPlugin,
      noPreRelease: false,
    })
    return nextVersion
  }

  const currentVersion = await repositoryPlugin.getCurrentVersion()
  const currentSemverVersion = semver.parse(currentVersion)
  if (!currentSemverVersion) {
    throw new Error(
      `Could not determine current version for ${repositoryPlugin.displayType} repository: ${repositoryPlugin.cwd}`,
    )
  }

  const autoIncrementVersion =
    await repositoryPlugin.autoIncrementVersion?.(currentSemverVersion)
  if (autoIncrementVersion) {
    console.log(
      `Auto-selecting next version "${autoIncrementVersion}" because "--force" was provided.`,
    )
    return autoIncrementVersion
  }

  const nextSemverVersion = currentSemverVersion.inc(
    currentSemverVersion.prerelease.length ? 'prerelease' : 'patch',
  )
  if (!nextSemverVersion) {
    throw new Error(
      `Could not auto-increment version "${currentVersion}" because "--force" was provided.`,
    )
  }

  console.log(
    `Auto-selecting next version "${nextSemverVersion.version}" because "--force" was provided.`,
  )
  return nextSemverVersion.version
}

async function scanProductRepositories({
  retainedClones,
}: {
  retainedClones: Map<string, RetainedClone>
}): Promise<{
  scannedRepositories: ScannedProductRepository[]
}> {
  const scannedRepositories: ScannedProductRepository[] = []

  for (const productRepository of productRepositories) {
    const {
      cloneRepository,
      repositoryWorkingDirectory,
      removeRepositoryWorkingDirectory,
    } = await prepareCloneRepository({
      repositoryName: productRepository.repositoryName,
    })

    try {
      await cloneRepository()

      const scannedRepository = await readScannedProductRepository({
        productRepository,
        repositoryWorkingDirectory,
      })
      scannedRepositories.push(scannedRepository)

      if (scannedRepository.supportsDependencyUpdates) {
        retainedClones.set(productRepository.repositoryName, {
          repositoryWorkingDirectory,
          removeRepositoryWorkingDirectory,
        })
      } else {
        await removeRepositoryWorkingDirectory()
      }
    } catch (error) {
      await removeRepositoryWorkingDirectory()
      throw error
    }
  }

  return {
    scannedRepositories,
  }
}

async function readScannedProductRepository({
  productRepository,
  repositoryWorkingDirectory,
}: {
  productRepository: ProductRepository
  repositoryWorkingDirectory: string
}): Promise<ScannedProductRepository> {
  const repositoryPlugin = await getRepositoryPlugin({
    cwd: repositoryWorkingDirectory,
    repositoryType: productRepository,
  })
  if (!repositoryPlugin.supportsDependencyUpdates) {
    console.log(
      `Skipping "${productRepository.repositoryName}" as "${repositoryPlugin.displayType}" does not support updating dependencies.`,
    )
    return {
      productRepository,
      packageName: undefined,
      packageVersion: undefined,
      dependencies: {},
      supportsDependencyUpdates: false,
    }
  }

  const result = await readPackageUp({
    cwd: repositoryWorkingDirectory,
  })
  return {
    productRepository,
    packageName: result?.packageJson.name,
    packageVersion: result?.packageJson.version,
    dependencies: result?.packageJson.dependencies || {},
    supportsDependencyUpdates: true,
  }
}

function getRepositoryNamesToRetain({
  candidates,
  intermediates,
  scannedRepositories,
}: {
  candidates: DependentCandidate[]
  intermediates: DependentCandidate[]
  scannedRepositories: ScannedProductRepository[]
}): Set<string> {
  const intermediatePackageNames = new Set(
    intermediates.map((intermediate) => intermediate.packageName),
  )
  const repositoryNamesToRetain = new Set(
    candidates.map((candidate) => candidate.productRepository.repositoryName),
  )

  for (const scannedRepository of scannedRepositories) {
    const dependsOnIntermediate = [...intermediatePackageNames].some(
      (packageName) => scannedRepository.dependencies[packageName],
    )
    if (dependsOnIntermediate) {
      repositoryNamesToRetain.add(
        scannedRepository.productRepository.repositoryName,
      )
    }
  }

  return repositoryNamesToRetain
}

async function pruneRetainedClones({
  retainedClones,
  repositoryNamesToRetain,
}: {
  retainedClones: Map<string, RetainedClone>
  repositoryNamesToRetain: Set<string>
}) {
  for (const [repositoryName, retainedClone] of retainedClones) {
    if (repositoryNamesToRetain.has(repositoryName)) {
      continue
    }
    await retainedClone.removeRepositoryWorkingDirectory()
    retainedClones.delete(repositoryName)
  }
}

function getRetainedWorkingDirectory({
  retainedClones,
  repositoryName,
}: {
  retainedClones: Map<string, RetainedClone>
  repositoryName: string
}): string {
  const retainedClone = retainedClones.get(repositoryName)
  if (!retainedClone) {
    throw new Error(
      `Expected retained clone for "${repositoryName}" but none was found.`,
    )
  }
  return retainedClone.repositoryWorkingDirectory
}

async function ensureRetainedWorkingDirectory({
  retainedClones,
  repositoryName,
}: {
  retainedClones: Map<string, RetainedClone>
  repositoryName: string
}): Promise<string> {
  const existingClone = retainedClones.get(repositoryName)
  if (existingClone) {
    return existingClone.repositoryWorkingDirectory
  }

  const {
    cloneRepository,
    repositoryWorkingDirectory,
    removeRepositoryWorkingDirectory,
  } = await prepareCloneRepository({
    repositoryName,
  })
  await cloneRepository()
  retainedClones.set(repositoryName, {
    repositoryWorkingDirectory,
    removeRepositoryWorkingDirectory,
  })
  return repositoryWorkingDirectory
}

async function removeRetainedClones(
  retainedClones: Map<string, RetainedClone>,
) {
  for (const retainedClone of retainedClones.values()) {
    await retainedClone.removeRepositoryWorkingDirectory()
  }
  retainedClones.clear()
}

function logSkippedRepository({
  scannedRepository,
  dependency,
  dependencyVersion,
  candidates,
}: {
  scannedRepository: ScannedProductRepository
  dependency: string
  dependencyVersion: string
  candidates: DependentCandidate[]
}) {
  if (!scannedRepository.supportsDependencyUpdates) {
    return
  }

  if (
    candidates.some(
      (candidate) =>
        candidate.productRepository.repositoryName ===
        scannedRepository.productRepository.repositoryName,
    )
  ) {
    return
  }

  const currentDependencyVersion = scannedRepository.dependencies[dependency]
  if (!currentDependencyVersion) {
    console.log(
      `Skipping "${scannedRepository.productRepository.repositoryName}" as it does not contain "${dependency}" as a dependency.`,
    )
    return
  }
  if (currentDependencyVersion === `^${dependencyVersion}`) {
    console.log(
      `Skipping "${scannedRepository.productRepository.repositoryName}" as it's version of "${dependency}" is already "${currentDependencyVersion}".`,
    )
    return
  }
  if (!scannedRepository.packageName || !scannedRepository.packageVersion) {
    console.log(
      `Skipping "${scannedRepository.productRepository.repositoryName}" as a package name/version could not be determined.`,
    )
  }
}

async function installDependencyUpdates({
  cwd,
  dependencies,
  releasedPackageVersions,
  isUpdatingTypes,
}: {
  cwd: string
  dependencies: Record<string, string | undefined>
  releasedPackageVersions: Map<string, string>
  isUpdatingTypes: boolean
}): Promise<string[]> {
  const { bumpedPackageNames, installSpecs } = getDependencyInstallSpecs({
    dependencies,
    releasedPackageVersions,
  })

  if (isUpdatingTypes) {
    await executeCommand(
      'npm',
      ['install', '--package-lock-only', '-D', '@oneblink/types'],
      cwd,
    )
  }

  if (installSpecs.length) {
    await executeCommand(
      'npm',
      ['install', '--package-lock-only', '--save', ...installSpecs],
      cwd,
    )
  }

  return bumpedPackageNames
}

async function commitDependencyUpdates({
  cwd,
  ticket,
  bumpedPackageNames,
  isUpdatingTypes,
}: {
  cwd: string
  ticket: string
  bumpedPackageNames: string[]
  isUpdatingTypes: boolean
}) {
  await executeCommand('git', ['add', '-A'], cwd)
  await executeCommand(
    'git',
    [
      'commit',
      '--message',
      buildDependencyBumpCommitMessage({
        ticket,
        bumpedPackageNames,
        isUpdatingTypes,
      }),
    ],
    cwd,
  )
}
