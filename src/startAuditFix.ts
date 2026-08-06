import fs from 'fs/promises'
import path from 'path'
import boxen from 'boxen'
import chalk from 'chalk'
import { execa } from 'execa'
import enumerateProductRepositories from './enumerateProductRepositories.js'
import executeCommand from './executeCommand.js'
import wrapWithLoading from './wrapWithLoading.js'
import createOrLinkPullRequest, {
  createPullRequestOctokit,
} from './createOrLinkPullRequest.js'
import resolveTicket from './resolveTicket.js'

export default async function startAuditFix({
  ticket: ticketFlag,
  force = false,
}: {
  ticket?: string
  force?: boolean
}) {
  const ticket = await resolveTicket({ ticketFlag, force })
  const octokit = createPullRequestOctokit()

  console.log(
    `Beginning audit fix across product repositories using branch "${ticket}"`,
  )

  const pullRequestUrls: string[] = []
  const fixedRepositories: string[] = []
  let createdAnyPullRequest = false
  let completedSuccessfully = false

  try {
    await enumerateProductRepositories(
      async ({ productRepository, repositoryWorkingDirectory }) => {
        const { repositoryName, type } = productRepository

        const auditFix =
          type === 'NUGET'
            ? await prepareNugetAuditFix({
                cwd: repositoryWorkingDirectory,
                repositoryName,
                ticket,
              })
            : await prepareNpmAuditFix({
                cwd: repositoryWorkingDirectory,
                repositoryName,
                ticket,
              })

        if (!auditFix) {
          return
        }

        const { filesToStage, commitMessage, pullRequestBody } = auditFix

        await executeCommand(
          'git',
          ['checkout', '-b', ticket],
          repositoryWorkingDirectory,
        )
        await executeCommand(
          'git',
          ['add', ...filesToStage],
          repositoryWorkingDirectory,
        )
        await executeCommand(
          'git',
          ['commit', '--message', commitMessage],
          repositoryWorkingDirectory,
        )
        await executeCommand(
          'git',
          ['push', '-u', 'origin', ticket],
          repositoryWorkingDirectory,
        )

        const pullRequest = await createOrLinkPullRequest({
          octokit,
          repositoryName,
          ticket,
          title: commitMessage,
          body: pullRequestBody,
        })

        fixedRepositories.push(repositoryName)
        pullRequestUrls.push(pullRequest.url)
        if (pullRequest.created) {
          createdAnyPullRequest = true
        }
      },
    )

    completedSuccessfully = true
  } finally {
    console.log(
      boxen(
        chalk[completedSuccessfully ? 'green' : 'yellow'](
          completedSuccessfully
            ? 'audit fix complete!!!'
            : 'audit fix stopped after an error',
        ),
        {
          padding: 1,
        },
      ),
    )

    if (fixedRepositories.length) {
      console.log(
        boxen(
          `The following repositories had fixes applied:

  ${fixedRepositories.join(`
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
    } else if (completedSuccessfully) {
      console.log(
        boxen(chalk.blue('No dependency audit fixes were produced.'), {
          padding: 1,
        }),
      )
    }
  }
}

type AuditFixResult = {
  filesToStage: string[]
  commitMessage: string
  pullRequestBody: string
}

async function prepareNpmAuditFix({
  cwd,
  repositoryName,
  ticket,
}: {
  cwd: string
  repositoryName: string
  ticket: string
}): Promise<AuditFixResult | undefined> {
  const packageLockPath = path.join(cwd, 'package-lock.json')
  if (!(await fileExists(packageLockPath))) {
    console.log(
      `Skipping "${repositoryName}" as it does not contain a package-lock.json file.`,
    )
    return
  }

  await runCommandAllowingRemainingVulnerabilities({
    command: 'npm',
    args: ['audit', 'fix', '--package-lock-only', '--audit-level=none'],
    cwd,
    hasChanges: () => hasFileChanges(cwd, 'package-lock.json'),
  })

  if (!(await hasFileChanges(cwd, 'package-lock.json'))) {
    console.log(
      `Skipping "${repositoryName}" as npm audit fix did not change package-lock.json.`,
    )
    return
  }

  const filesToStage = ['package-lock.json']

  // npm audit fix can also update package.json when dependency ranges change
  if (await hasFileChanges(cwd, 'package.json')) {
    filesToStage.push('package.json')
  }

  return {
    filesToStage,
    commitMessage: `${ticket} # npm audit fix`,
    pullRequestBody: 'Automated `npm audit fix`.',
  }
}

async function prepareNugetAuditFix({
  cwd,
  repositoryName,
  ticket,
}: {
  cwd: string
  repositoryName: string
  ticket: string
}): Promise<AuditFixResult | undefined> {
  await runCommandAllowingRemainingVulnerabilities({
    command: 'dotnet',
    args: ['package', 'update', '--vulnerable'],
    cwd,
    hasChanges: () => hasNugetPackageChanges(cwd),
  })

  const filesToStage = await getChangedNugetPackageFiles(cwd)
  if (!filesToStage.length) {
    console.log(
      `Skipping "${repositoryName}" as dotnet package update --vulnerable did not change csproj files.`,
    )
    return
  }

  return {
    filesToStage,
    commitMessage: `${ticket} # dotnet package update --vulnerable`,
    pullRequestBody: 'Automated `dotnet package update --vulnerable`.',
  }
}

async function runCommandAllowingRemainingVulnerabilities({
  command,
  args,
  cwd,
  hasChanges,
}: {
  command: string
  args: string[]
  cwd: string
  hasChanges: () => Promise<boolean>
}) {
  const log = `"${command} ${args.join(' ')}"`
  return await wrapWithLoading(
    {
      startText: `Running ${log}`,
      failText: `Failed to run ${log}`,
    },
    async (spinner) => {
      // Both npm audit fix and dotnet package update --vulnerable can exit
      // non-zero when vulnerabilities remain after applying available fixes
      const result = await execa(command, args, {
        cwd,
        reject: false,
      })

      if (result.exitCode !== 0 && !(await hasChanges())) {
        spinner.fail(`Failed to run ${log}`)
        throw new Error(
          result.stderr ||
            result.stdout ||
            `${command} ${args.join(' ')} failed with exit code ${result.exitCode}`,
        )
      }

      spinner.succeed(`Ran ${log}`)
      return result
    },
  )
}

async function hasNugetPackageChanges(cwd: string): Promise<boolean> {
  return (await getChangedNugetPackageFiles(cwd)).length > 0
}

async function getChangedNugetPackageFiles(cwd: string): Promise<string[]> {
  const { stdout } = await execa(
    'git',
    ['status', '--porcelain', '--', '*.csproj'],
    {
      cwd,
    },
  )

  return stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      // Porcelain status is always 2 characters followed by a space
      const pathPart = line.slice(3)
      const renameSeparator = ' -> '
      const renameIndex = pathPart.indexOf(renameSeparator)
      return renameIndex === -1
        ? pathPart.trim()
        : pathPart.slice(renameIndex + renameSeparator.length).trim()
    })
}

async function hasFileChanges(cwd: string, fileName: string): Promise<boolean> {
  const { stdout } = await execa(
    'git',
    ['status', '--porcelain', '--', fileName],
    {
      cwd,
    },
  )
  return Boolean(stdout.trim())
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath)
    return true
  } catch {
    return false
  }
}
