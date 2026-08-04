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
  ScannedProductRepository,
} from './updateDependentsPlanning.js'

type RetainedClone = {
  repositoryWorkingDirectory: string
  removeRepositoryWorkingDirectory: () => Promise<void>
}

const TICKET_PATTERN = /^[a-z]{1,3}-\d+$/i

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

  const { scannedRepositories, retainedClones } = await scanProductRepositories(
    {
      dependency,
      dependencyVersion,
    },
  )

  try {
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

    const intermediates = getIntermediateNpmDependents(candidates)
    const sortedIntermediates =
      topologicallySortByPackageDependencies(intermediates)

    const releasedPackageVersions = new Map<string, string>([
      [dependency, dependencyVersion],
    ])
    const releasedRepositoryNames = new Set<string>()
    const releasedPackageSummaries: string[] = []
    const createPullRequestUrls: string[] = []

    for (const intermediate of sortedIntermediates) {
      const downstreamRepositoryNames = getDownstreamRepositoryNames({
        candidates,
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
        candidate: intermediate,
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

    for (const candidate of candidates) {
      if (
        releasedRepositoryNames.has(candidate.productRepository.repositoryName)
      ) {
        continue
      }

      let isUpdating: 'yes' | 'no'
      if (shouldForceUpdateDependency) {
        isUpdating = 'yes'
        console.log(
          `Auto-updating "${dependency}" in "${candidate.productRepository.repositoryName}" (${candidate.currentSourceDependencyVersion} > ${dependencyVersion})`,
        )
      } else {
        const updateResult = await enquirer.prompt<{
          isUpdating: 'yes' | 'no'
        }>({
          type: 'select',
          name: 'isUpdating',
          message: `Would you like to update dependencies in "${candidate.productRepository.repositoryName}" (${candidate.currentSourceDependencyVersion} > ${dependencyVersion})?`,
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

      const repositoryWorkingDirectory = getRetainedWorkingDirectory({
        retainedClones,
        candidate,
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
      createPullRequestUrls.push(
        `https://github.com/oneblink/${candidate.productRepository.repositoryName}/pull/new/${ticket}`,
      )
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

    if (createPullRequestUrls.length) {
      console.log(
        boxen(
          `The following Pull Requests can be created:

  ${createPullRequestUrls.join(`
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

async function resolveTicket({
  ticketFlag,
  force,
}: {
  ticketFlag: string | undefined
  force: boolean
}): Promise<string> {
  if (ticketFlag) {
    if (!TICKET_PATTERN.test(ticketFlag)) {
      throw new Error(
        'Ticket must be 1-3 alpha characters, then a hyphen followed by a number',
      )
    }
    return ticketFlag.toUpperCase()
  }

  if (force) {
    throw new Error(
      'Cannot use "--force" without "--ticket" because all prompts are skipped.',
    )
  }

  const { ticket } = await enquirer.prompt<{
    ticket: string
  }>({
    type: 'input',
    name: 'ticket',
    message: `Ticket to associate with pull requests? (e.g. ON-4323, AP-4323, MS-4323)`,
    required: true,
    validate: (input) => {
      if (!TICKET_PATTERN.test(input)) {
        return 'Ticket must be 1-3 alpha characters, then a hyphen followed by a number'
      }
      return true
    },
    result: (input) => input.toUpperCase(),
  })

  return ticket
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
  dependency,
  dependencyVersion,
}: {
  dependency: string
  dependencyVersion: string
}): Promise<{
  scannedRepositories: ScannedProductRepository[]
  retainedClones: Map<string, RetainedClone>
}> {
  const scannedRepositories: ScannedProductRepository[] = []
  const retainedClones = new Map<string, RetainedClone>()

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

      const [candidate] = getDependentCandidates({
        scannedRepositories: [scannedRepository],
        dependency,
        dependencyVersion,
      })

      if (candidate) {
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
    retainedClones,
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

function getRetainedWorkingDirectory({
  retainedClones,
  candidate,
}: {
  retainedClones: Map<string, RetainedClone>
  candidate: DependentCandidate
}): string {
  const retainedClone = retainedClones.get(
    candidate.productRepository.repositoryName,
  )
  if (!retainedClone) {
    throw new Error(
      `Expected retained clone for "${candidate.productRepository.repositoryName}" but none was found.`,
    )
  }
  return retainedClone.repositoryWorkingDirectory
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
