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
