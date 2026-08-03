export default function topologicallySortByPackageDependencies<
  T extends {
    packageName: string
    dependencies: Record<string, string | undefined>
  },
>(packages: T[]): T[] {
  const packagesByName = new Map(
    packages.map((pkg) => [pkg.packageName, pkg] as const),
  )
  const sorted: T[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()

  function visit(pkg: T) {
    if (visited.has(pkg.packageName)) {
      return
    }
    if (visiting.has(pkg.packageName)) {
      throw new Error(
        `Circular dependency detected while ordering NPM packages to release (involving "${pkg.packageName}")`,
      )
    }

    visiting.add(pkg.packageName)

    for (const dependencyName of Object.keys(pkg.dependencies)) {
      const dependency = packagesByName.get(dependencyName)
      if (dependency) {
        visit(dependency)
      }
    }

    visiting.delete(pkg.packageName)
    visited.add(pkg.packageName)
    sorted.push(pkg)
  }

  for (const pkg of packages) {
    visit(pkg)
  }

  return sorted
}
