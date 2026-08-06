import { execa } from 'execa'
import wrapWithLoading from '../wrapWithLoading.js'

export async function runCommandAllowingRemainingVulnerabilities({
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

export async function hasFileChanges(
  cwd: string,
  fileName: string,
): Promise<boolean> {
  const { stdout } = await execa(
    'git',
    ['status', '--porcelain', '--', fileName],
    {
      cwd,
    },
  )
  return Boolean(stdout.trim())
}

export async function getChangedFilesMatching(
  cwd: string,
  ...pathspecs: string[]
): Promise<string[]> {
  const { stdout } = await execa(
    'git',
    ['status', '--porcelain', '--', ...pathspecs],
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
