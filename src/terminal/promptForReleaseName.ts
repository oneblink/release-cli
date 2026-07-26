import enquirer from 'enquirer'

export default async function promptForReleaseName() {
  const { releaseName } = await enquirer.prompt<{
    releaseName: string
  }>([
    {
      type: 'input',
      message: 'Release name? i.e. JIRA release',
      name: 'releaseName',
      required: true,
    },
  ])
  return releaseName
}
