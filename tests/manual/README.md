# Manual Test Scripts

Ad-hoc testing scripts for manual verification during development.

## Scripts

- **test-download.js** - Test file download API endpoints
  ```bash
  node tests/manual/test-download.js
  ```

- **test-file-service.ts** - Test file service functionality
  ```bash
  bun run tests/manual/test-file-service.ts
  ```

## Usage

These scripts are for manual testing and debugging. Run them directly:

```bash
# Ensure API is running first
bun run dev:api

# Then run tests
node tests/manual/test-download.js
bun run tests/manual/test-file-service.ts
```

## Note

For automated tests, see `tests/unit/` and `tests/integration/` directories.
