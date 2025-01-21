import path from 'path'
import generateCodeChangelogEntries from '../../../src/changelog/generateCodeChangelogEntries.js'

describe('generateCodeChangelogEntries', () => {
  const fixturesPath = path.resolve(process.cwd(), 'test', 'fixtures')

  it('should process changelog entries and format them', async () => {
    const cwd = path.join(fixturesPath, 'valid-changelog')
    console.log('cwd', cwd)

    const result = await generateCodeChangelogEntries({ cwd })

    expect(result.entryFiles).toHaveLength(2)
    expect(result.formatted).toMatchSnapshot()
  })

  it('should handle empty changelog directory', async () => {
    const cwd = path.join(fixturesPath, 'empty-changelog')
    console.log('cwd', cwd)

    const result = await generateCodeChangelogEntries({ cwd })

    expect(result.entryFiles).toHaveLength(0)
    expect(result.formatted).toMatchSnapshot()
  })
})
