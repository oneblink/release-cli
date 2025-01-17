# OneBlink Release CLI [![npm module](https://img.shields.io/npm/v/@oneblink/release-cli.svg)](https://www.npmjs.com/package/@oneblink/release-cli) [![tests](https://github.com/oneblink/release-cli/actions/workflows/test.yml/badge.svg)](https://github.com/oneblink/release-cli/actions)

Used internally by OneBlink to release repositories quickly and consistently

## CLI Requirements

- [Node.js](https://nodejs.org/) 20.0 or newer
- NPM 10.0 or newer
- See recommendation from [package-diff-summary](https://github.com/jokeyrhyme/package-diff-summary.js#github_oauth_token) regarding [GitHub API Rate Limiting](https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting)

## Installation

```sh
npm install -g @oneblink/release-cli
```

## Project Requirements

The project that is being released must meet following requirements

- Must have a `CHANGELOG.md` file in the root directory
- `CHANGELOG.md` must follow the standard outlined in [changelog-parser](https://www.npmjs.com/package/changelog-parser)
- Git tags that are created will be [annotated](https://git-scm.com/book/en/v2/Git-Basics-Tagging#_annotated_tags) and prefixed with a `v` e.g. `v1.11.2`

## Usage

Run the following command for usage information

```sh
oneblink-release --help
```

## Changelog Automation

To avoid constant merge conflicts with the `CHANGELOG.md` file. The Release CLI can automate changelog entries by allow developers to create a single file for each change entry (or a as many entries as the developer would like to add in that single file). Start by creating a directory called: `changelog-entries` in the root of the repository and add a `.keep` file to the directory, like so:

```
|- changelog-entries/
   |- .keep
|- src/
   |- index.js
|- .gitignore
|- package.json
|- README.md
```

The `.keep` file will simply prevent the directory from being removed from source control after each release.

Each time a developer wants to add an entry to the changelog as part of the current release, create a file in the `changelog-entries` directory. The file must adhere to the [keepachangelog](https://keepachangelog.com/) format.

Files can have as many entries as desired, however it is recommended to keep entries small to avoid merge conflicts with other developers.

**All of the entry files will be removed as part of the release.**

### Example Changelog Entry Files

The following two files:

- `kitchen-sink.md`

  ````md
  ### Changed

  - the supported NodeJS version
  - the name of a function. See the change below to migrate to the new function:
    ```diff
    -thisIsTheOldFunction()
    +thisIsTheNewFunction()
    ```

  ### Removed

  - something that was not being used anymore

  ### Added

  - a new feature

  ### Fixed

  - a bug
  ````

- `my-additions.md`

  ```md
  ### Added

  - a really simple feature
  ```

Would result in the following change entry:

### Changed

- the supported NodeJS version
- the name of a function. See the change below to migrate to the new function:
  ```diff
  -thisIsTheOldFunction()
  +thisIsTheNewFunction()
  ```

### Removed

- something that was not being used anymore

### Added

- a new feature
- a really simple feature

### Fixed

- a bug
