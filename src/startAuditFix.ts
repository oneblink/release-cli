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
}: {
  ticket?: string
}) {
  const ticket = await resolveTicket({ ticketFlag })
  const octokit = createPullRequestOctokit()

  console.log(
    `Beginning npm audit fix across product repositories using branch "${ticket}"`,
  )

  const pullRequestUrls: string[] = []
  const fixedRepositories: string[] = []
  let createdAnyPullRequest = false

  await enumerateProductRepositories(
    async ({ productRepository, repositoryWorkingDirectory }) => {
      const { repositoryName, type } = productRepository

      if (type === 'NUGET') {
        console.log(
          `Skipping "${repositoryName}" as NuGet repositories do not support npm audit fix.`,
        )
        return
      }

      const packageLockPath = path.join(
        repositoryWorkingDirectory,
        'package-lock.json',
      )
      if (!(await fileExists(packageLockPath))) {
        console.log(
          `Skipping "${repositoryName}" as it does not contain a package-lock.json file.`,
        )
        return
      }

      await runNpmAuditFix(repositoryWorkingDirectory)

      const packageLockChanged = await hasPackageLockChanges(
        repositoryWorkingDirectory,
      )
      if (!packageLockChanged) {
        console.log(
          `Skipping "${repositoryName}" as npm audit fix did not change package-lock.json.`,
        )
        return
      }

      const commitMessage = `${ticket} # npm audit fix`

      await executeCommand(
        'git',
        ['checkout', '-b', ticket],
        repositoryWorkingDirectory,
      )
      await executeCommand(
        'git',
        ['add', 'package-lock.json'],
        repositoryWorkingDirectory,
      )

      // npm audit fix can also update package.json when dependency ranges change
      const packageJsonChanged = await hasFileChanges(
        repositoryWorkingDirectory,
        'package.json',
      )
      if (packageJsonChanged) {
        await executeCommand(
          'git',
          ['add', 'package.json'],
          repositoryWorkingDirectory,
        )
      }

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
        body: 'Automated `npm audit fix`.',
      })

      fixedRepositories.push(repositoryName)
      pullRequestUrls.push(pullRequest.url)
      if (pullRequest.created) {
        createdAnyPullRequest = true
      }
    },
  )

  console.log(
    boxen(chalk.green('npm audit fix complete!!!'), {
      padding: 1,
    }),
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
  } else {
    console.log(
      boxen(chalk.blue('No package-lock.json changes were produced.'), {
        padding: 1,
      }),
    )
  }
}

async function runNpmAuditFix(cwd: string) {
  const log = '"npm audit fix --package-lock-only --audit-level=none"'
  return await wrapWithLoading(
    {
      startText: `Running ${log}`,
      failText: `Failed to run ${log}`,
    },
    async (spinner) => {
      // npm audit fix exits non-zero when vulnerabilities remain after applying fixes
      const result = await execa(
        'npm',
        ['audit', 'fix', '--package-lock-only', '--audit-level=none'],
        {
          cwd,
          reject: false,
        },
      )

      if (result.exitCode !== 0 && !(await hasPackageLockChanges(cwd))) {
        spinner.fail(`Failed to run ${log}`)
        throw new Error(
          result.stderr ||
            result.stdout ||
            `npm audit fix --package-lock-only --audit-level=none failed with exit code ${result.exitCode}`,
        )
      }

      spinner.succeed(`Ran ${log}`)
      return result
    },
  )
}

async function hasPackageLockChanges(cwd: string): Promise<boolean> {
  return await hasFileChanges(cwd, 'package-lock.json')
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
