# Tests Directory

Test files and testing utilities for the backend application.

## What Goes Here

- Integration tests
- API endpoint tests
- Test utilities and helpers
- Mock data and fixtures
- Database setup/teardown for tests
- Examples:
  - `setup.ts` - Test environment configuration
  - `helpers.ts` - Testing utilities
  - `fixtures/` - Mock data
  - `integration/` - Integration tests
  - `e2e/` - End-to-end API tests

## Testing Strategy

- Unit tests should live alongside the code they test
- Integration tests verify interactions between modules
- E2E tests verify complete workflows
- Mock external services (AI APIs, storage, etc.)

## Test Structure

Use a testing framework like Jest, Mocha, or Vitest with supertest for API testing.
