import { describe, expect, it } from 'vitest'
import topologicallySortByPackageDependencies from '../src/topologicallySortByPackageDependencies.js'

describe('topologicallySortByPackageDependencies', () => {
  it('orders packages so dependencies are released before dependents', () => {
    const sorted = topologicallySortByPackageDependencies([
      {
        packageName: '@oneblink/apps-react',
        dependencies: {
          '@oneblink/sdk-core': '^10.0.0',
          '@oneblink/storage': '^7.0.0',
        },
      },
      {
        packageName: '@oneblink/storage',
        dependencies: {
          '@oneblink/sdk-core': '^10.0.0',
        },
      },
    ])

    expect(sorted.map((pkg) => pkg.packageName)).toEqual([
      '@oneblink/storage',
      '@oneblink/apps-react',
    ])
  })

  it('keeps unrelated packages in a stable visit order', () => {
    const sorted = topologicallySortByPackageDependencies([
      {
        packageName: '@oneblink/cli',
        dependencies: {},
      },
      {
        packageName: '@oneblink/sdk',
        dependencies: {},
      },
    ])

    expect(sorted.map((pkg) => pkg.packageName)).toEqual([
      '@oneblink/cli',
      '@oneblink/sdk',
    ])
  })

  it('throws when a circular dependency is detected', () => {
    expect(() =>
      topologicallySortByPackageDependencies([
        {
          packageName: 'a',
          dependencies: {
            b: '^1.0.0',
          },
        },
        {
          packageName: 'b',
          dependencies: {
            a: '^1.0.0',
          },
        },
      ]),
    ).toThrow('Circular dependency detected')
  })
})
