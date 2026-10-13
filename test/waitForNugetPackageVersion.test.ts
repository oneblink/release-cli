import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchMock, setTimeoutMock, wrapWithLoadingMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  setTimeoutMock: vi.fn(async () => undefined),
  wrapWithLoadingMock: vi.fn(
    async (
      _options: { startText: string; failText: string },
      fn: (spinner: {
        succeed: ReturnType<typeof vi.fn>
        text: string
      }) => Promise<void>,
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

vi.stubGlobal('fetch', fetchMock)

vi.mock('node:timers/promises', () => ({
  setTimeout: setTimeoutMock,
}))

vi.mock('../src/wrapWithLoading.js', () => ({
  default: wrapWithLoadingMock,
}))

import waitForNugetPackageVersion from '../src/waitForNugetPackageVersion.js'

describe('waitForNugetPackageVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setTimeoutMock.mockResolvedValue(undefined)
  })

  it('resolves when nuget.org lists the expected version', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ versions: ['10.0.0', '10.1.0'] }),
    })

    await waitForNugetPackageVersion({
      packageName: 'OneBlink.SDK',
      version: '10.1.0',
      timeoutMs: 1_000,
      pollIntervalMs: 10,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.nuget.org/v3-flatcontainer/oneblink.sdk/index.json',
    )
    expect(setTimeoutMock).not.toHaveBeenCalled()
  })

  it('polls until the package version becomes available', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ versions: ['10.1.0'] }),
      })

    await waitForNugetPackageVersion({
      packageName: 'OneBlink.SDK',
      version: '10.1.0',
      timeoutMs: 1_000,
      pollIntervalMs: 25,
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(setTimeoutMock).toHaveBeenCalledWith(25)
  })

  it('throws when the package is not published before the timeout', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
    })

    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy.mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(2_000)

    await expect(
      waitForNugetPackageVersion({
        packageName: 'OneBlink.SDK',
        version: '10.1.0',
        timeoutMs: 1_000,
        pollIntervalMs: 10,
      }),
    ).rejects.toThrow(
      'Timed out after 1000ms waiting for OneBlink.SDK@10.1.0 to be published to NuGet. Investigate why the package was not published (for example CI or NuGet publish failures), then decide whether it is safe to run the command again from the beginning.',
    )

    nowSpy.mockRestore()
  })
})
