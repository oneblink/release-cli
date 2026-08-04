import { beforeEach, describe, expect, it, vi } from 'vitest'

const { execaMock, setTimeoutMock, wrapWithLoadingMock } = vi.hoisted(() => ({
  execaMock: vi.fn(),
  setTimeoutMock: vi.fn(async () => undefined),
  wrapWithLoadingMock: vi.fn(
    async (
      _options: { startText: string; failText: string },
      fn: (spinner: { succeed: ReturnType<typeof vi.fn>; text: string }) => Promise<void>,
    ) => {
      const spinner = {
        succeed: vi.fn(),
        text: '',
      }
      await fn(spinner)
      return undefined
    },
  ),
}))

vi.mock('execa', () => ({
  execa: execaMock,
}))

vi.mock('node:timers/promises', () => ({
  setTimeout: setTimeoutMock,
}))

vi.mock('../src/wrapWithLoading.js', () => ({
  default: wrapWithLoadingMock,
}))

import waitForNpmPackageVersion from '../src/waitForNpmPackageVersion.js'

describe('waitForNpmPackageVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setTimeoutMock.mockResolvedValue(undefined)
  })

  it('resolves when npm view returns the expected version', async () => {
    execaMock.mockResolvedValueOnce({
      stdout: '10.1.0\n',
      exitCode: 0,
    })

    await waitForNpmPackageVersion({
      packageName: '@oneblink/sdk-core',
      version: '10.1.0',
      timeoutMs: 1_000,
      pollIntervalMs: 10,
    })

    expect(execaMock).toHaveBeenCalledWith(
      'npm',
      ['view', '@oneblink/sdk-core@10.1.0', 'version'],
      { reject: false },
    )
    expect(setTimeoutMock).not.toHaveBeenCalled()
  })

  it('polls until the package version becomes available', async () => {
    execaMock
      .mockResolvedValueOnce({
        stdout: '',
        exitCode: 1,
      })
      .mockResolvedValueOnce({
        stdout: '10.1.0',
        exitCode: 0,
      })

    await waitForNpmPackageVersion({
      packageName: '@oneblink/sdk-core',
      version: '10.1.0',
      timeoutMs: 1_000,
      pollIntervalMs: 25,
    })

    expect(execaMock).toHaveBeenCalledTimes(2)
    expect(setTimeoutMock).toHaveBeenCalledWith(25)
  })

  it('throws when the package is not published before the timeout', async () => {
    execaMock.mockResolvedValue({
      stdout: '',
      exitCode: 1,
    })

    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy.mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(2_000)

    await expect(
      waitForNpmPackageVersion({
        packageName: '@oneblink/sdk-core',
        version: '10.1.0',
        timeoutMs: 1_000,
        pollIntervalMs: 10,
      }),
    ).rejects.toThrow(
      'Timed out after 1000ms waiting for @oneblink/sdk-core@10.1.0 to be published to npm. Investigate why the package was not published (for example CI or npm publish failures), then decide whether it is safe to run the command again from the beginning.',
    )

    nowSpy.mockRestore()
  })
})
