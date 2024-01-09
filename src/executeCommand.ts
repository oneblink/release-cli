import { execa } from 'execa'
import wrapWithLoading from './wrapWithLoading.js'

export default async function executeCommand(
  command: string,
  args: string[],
  cwd: string,
) {
  const log = `"${command} ${args.join(' ')}"`
  await wrapWithLoading(
    {
      startText: `Running ${log}`,
      failText: `Failed to run ${log}`,
    },
    async (spinner) => {
      await execa(command, args, {
        cwd,
      })

      spinner.succeed(`Ran ${log}`)
    },
  )
}
