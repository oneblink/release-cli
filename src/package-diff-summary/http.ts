async function isUrlHealthy(testUrl: string): Promise<boolean> {
  const response = await fetch(testUrl, {
    method: 'HEAD',
  })
  return response.ok
}

export { isUrlHealthy }
