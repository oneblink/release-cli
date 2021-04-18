# Contributing

## Git Branch Workflow

This project adheres to [GitHub Flow](https://guides.github.com/introduction/flow/).

## Development

- This package is pure ESM. Please [read this](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c).

## Release Process

1. Checkout `master`

   ```
   git checkout master
   ```

1. Get the latest code

   ```
   git pull
   ```

1. Build the latest code

   ```
   npm run build
   ```

1. Run the release process

   ```
   node ./dist/bin.js
   ```
