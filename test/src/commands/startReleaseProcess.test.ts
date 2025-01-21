import startRepositoryRelease from '../../../src/commands/startRepositoryRelease.js'

test('startReleaseProcess should be a function', () => {
  expect(typeof startRepositoryRelease).toBe('function')
})
