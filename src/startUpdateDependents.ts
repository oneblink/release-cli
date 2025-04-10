import { readPackageUp } from 'read-package-up'
import enumerateProductRepositories from './enumerateProductRepositories.js'
import getRepositoryPlugin from './repositories-plugins/plugins-factory.js'
import enquirer from 'enquirer'
import executeCommand from './executeCommand.js'
import boxen from 'boxen'

export default async function startUpdateDependents({ cwd }: { cwd: string }) {
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
  console.log('Beginning to update the dependents of:', dependency)

  const { ticket } = await enquirer.prompt<{
    ticket: string
  }>({
    type: 'input',
    name: 'ticket',
    message: `Ticket to associate with pull requests? (e.g. ON-4323, AP-4323, MS-4323)`,
    required: true,
    validate: (input) => {
      if (!/^[a-z]{1,3}-\d+$/i.test(input)) {
        return 'Ticket must be "ON-" or "AP-" or "MS-" followed by a number'
      }
      return true
    },
    result: (input) => input.toUpperCase(),
  })

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

  const createPullRequestUrls: string[] = []

  await enumerateProductRepositories(
    async ({ productRepository, repositoryWorkingDirectory }) => {
      const repositoryPlugin = await getRepositoryPlugin({
        cwd: repositoryWorkingDirectory,
        repositoryType: productRepository,
      })
      if (!repositoryPlugin.supportsDependencyUpdates) {
        console.log(
          `Skipping "${productRepository.repositoryName}" as "${repositoryPlugin.displayType}" does not support updating dependencies.`,
        )
        return
      }

      const result = await readPackageUp({
        cwd: repositoryWorkingDirectory,
      })
      const currentDependencyVersion =
        result?.packageJson.dependencies?.[dependency]
      if (!currentDependencyVersion) {
        console.log(
          `Skipping "${productRepository.repositoryName}" as it does not contain "${dependency}" as a dependency.`,
        )
        return
      }
      if (
        currentDependencyVersion === `^${dependencyResult.packageJson.version}`
      ) {
        console.log(
          `Skipping "${productRepository.repositoryName}" as it's version of "${dependency}" is already "${currentDependencyVersion}".`,
        )
        return
      }

      const { isUpdating } = await enquirer.prompt<{
        isUpdating: 'yes' | 'no'
      }>({
        type: 'select',
        name: 'isUpdating',
        message: `Would you like to update "${dependency}" in "${productRepository.repositoryName}" (${currentDependencyVersion} > ${dependencyResult.packageJson.version})?`,
        choices: [
          {
            message: 'Yes, update dependency!',
            name: 'yes',
          },
          {
            message: `No! "${productRepository.repositoryName}" does not need to be updated.`,
            name: 'no',
          },
        ],
      })
      if (isUpdating === 'no') {
        return
      }

      await executeCommand(
        'git',
        ['checkout', '-b', ticket],
        repositoryWorkingDirectory,
      )
      if (isUpdatingTypes === 'yes') {
        await executeCommand(
          'npm',
          ['install', '--package-lock-only', '-D', '@oneblink/types'],
          repositoryWorkingDirectory,
        )
      }
      await executeCommand(
        'npm',
        [
          'install',
          '--package-lock-only',
          '--save',
          `${dependency}@${dependencyResult.packageJson.version}`,
        ],
        repositoryWorkingDirectory,
      )
      await executeCommand('git', ['add', '-A'], repositoryWorkingDirectory)
      await executeCommand(
        'git',
        ['commit', '--message', `${ticket} # Bumped ${dependency}`],
        repositoryWorkingDirectory,
      )
      await executeCommand(
        'git',
        ['push', '-u', 'origin', ticket],
        repositoryWorkingDirectory,
      )
      createPullRequestUrls.push(
        `https://github.com/oneblink/${productRepository.repositoryName}/pull/new/${ticket}`,
      )
    },
  )

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
}
