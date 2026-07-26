import ora, { Ora } from 'ora'

export default async function wrapWithLoading<T>(
  { startText, failText }: { startText: string; failText: string },
  fn: (spinner: Ora) => Promise<T>,
): Promise<T> {
  const spinner = ora(startText).start()
  try {
    const t = await fn(spinner)
    if (spinner.isSpinning) {
      spinner.stop()
    }
    return t
  } catch (error) {
    spinner.fail(failText)
    throw error
  }
}
