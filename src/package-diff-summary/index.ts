import { readPackageUp } from 'read-package-up'

import * as git from './git.js'
import * as diff from './diff.js'

async function main({
  previousVersion,
  cwd,
}: {
  previousVersion: string
  cwd: string
}): Promise<string | undefined> {
  const oldPkg = JSON.parse(
    await git.gitShow(previousVersion, 'package.json', cwd),
  )
  const result = await readPackageUp({ cwd })

  if (result) {
    const delta = diff.diffPackages(oldPkg, result.packageJson)
    const text = await diff.deltaToMarkdown(delta, oldPkg, cwd) // CLI tool, relax!
    return text
  }
}

export { main }
