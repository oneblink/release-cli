# Contributing

## Git Branch Workflow

This project adheres to [GitHub Flow](https://guides.github.com/introduction/flow/).

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
