# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- release name to git commit and tag message

## [2.0.1] - 2023-04-03

### Fixed

- changelog title not being supported by [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) which breaks the [antonyurchenko/git-release](https://github.com/anton-yurchenko/git-release) GitHub Action

## [2.0.0] (2023-04-03)

### Added

- release name prompt to add name of release to changelog (can also be set via `--name="Release Name"` flag)
- `--no-name` flag to allow skipping adding a release name to the changelog

### Changed

- **[BREAKING]** required NodeJS 18

### Dependencies

- update [execa](https://www.npmjs.com/package/execa) to [7.1.1](https://github.com/sindresorhus/execa/releases/tag/v7.1.1) (from [5.0.0](https://github.com/sindresorhus/execa/releases/tag/v5.0.0))

- update [meow](https://www.npmjs.com/package/meow) to [11.0.0](https://github.com/sindresorhus/meow/releases/tag/v11.0.0) (from [9.0.0](https://github.com/sindresorhus/meow/releases/tag/v9.0.0))

- update [ora](https://www.npmjs.com/package/ora) to [6.3.0](https://github.com/sindresorhus/ora/releases/tag/v6.3.0) (from [5.4.0](https://github.com/sindresorhus/ora/releases/tag/v5.4.0))

- update [patch-package](https://www.npmjs.com/package/patch-package) to [6.5.1](https://github.com/ds300/patch-package/releases/tag/v6.5.1) (from [6.4.7](https://github.com/ds300/patch-package/releases/tag/v6.4.7))

- update [prettier](https://www.npmjs.com/package/prettier) to [2.8.7](https://github.com/prettier/prettier/releases/tag/2.8.7) (from [2.2.1](https://github.com/prettier/prettier/releases/tag/2.2.1))

- update [read-pkg-up](https://www.npmjs.com/package/read-pkg-up) to [9.1.0](https://github.com/sindresorhus/read-pkg-up/releases/tag/v9.1.0) (from [7.0.1](https://github.com/sindresorhus/read-pkg-up/releases/tag/v7.0.1))

- update [semver](https://www.npmjs.com/package/semver) to [7.3.8](https://github.com/npm/node-semver/releases/tag/v7.3.8) (from [7.3.5](https://github.com/npm/node-semver/blob/master/CHANGELOG.md))

- update [update-notifier](https://www.npmjs.com/package/update-notifier) to [6.0.2](https://github.com/yeoman/update-notifier/releases/tag/v6.0.2) (from [5.1.0](https://github.com/yeoman/update-notifier/releases/tag/v5.1.0))

## [1.2.0] - 2022-08-26

### Moved

- `patch-package` to deps

### Added

- `patches` dir to `files` in `package.json` file
- `changelog-parser` to `bundleDependencies`

## [1.1.0] - 2022-08-26

### Patched

- `changelog-parser` to use `\n` as line endings instead of detecting based on platform

## [1.0.0] - 2021-04-21

### Added

- Initial Release
