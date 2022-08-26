declare module 'package-diff-summary' {
  export function main(options: {
    previousVersion: string
    cwd: string
  }): string
}
