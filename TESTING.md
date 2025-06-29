# Testing Guide

This guide provides comprehensive instructions for running tests in the Enterprise Certificate Manager project.

## Prerequisites

Before running tests, ensure you have the necessary dependencies installed.

### Backend Testing

The backend uses Jest for testing. Dependencies are already installed.

### Frontend Testing Setup

Install the required testing dependencies for the frontend:

```bash
cd frontend
npm install --save-dev @testing-library/react@^14.1.2 @testing-library/jest-dom@^6.1.5 @testing-library/user-event@^14.5.1 vitest@^1.0.4 @vitest/ui@^1.0.4 @vitest/coverage-v8@^1.0.4 jsdom@^23.0.1
```

Add the following scripts to your `frontend/package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

## Running Tests

### Backend Tests

Run backend tests from the project root or backend directory:

```bash
# From project root
cd backend && npm test

# Or from backend directory
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- tests/ai.test.js
```

### Frontend Tests

Run frontend tests from the frontend directory:

```bash
cd frontend

# Run all tests once
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with UI (browser interface)
npm run test:ui

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test -- src/tests/AISettingsModal.test.tsx
```

## Test Structure

### Backend Test Files

- `backend/tests/ai.test.js` - AI settings API endpoint tests
- `backend/tests/aiService.test.js` - AI service layer tests
- `backend/tests/setup.js` - Global test setup and utilities

### Frontend Test Files

- `frontend/src/tests/AISettingsModal.test.tsx` - AI settings modal component tests
- `frontend/src/tests/aiService.test.ts` - AI service client tests
- `frontend/src/tests/setup.ts` - Global test setup and mocks

## Test Coverage

### Backend Coverage

The backend tests cover:

- **Authentication middleware** - JWT token validation
- **API endpoints** - All AI settings CRUD operations
- **Input validation** - Request body and parameter validation
- **Error handling** - Database errors, validation errors, network errors
- **Security** - API key encryption and user isolation

### Frontend Coverage

The frontend tests cover:

- **Component rendering** - Modal display and state management
- **User interactions** - Form inputs, button clicks, tab switching
- **API integration** - Service calls and error handling
- **Validation logic** - API key format validation
- **State management** - Settings updates and provider management

## Test Configuration

### Backend Configuration (Jest)

Configuration is in `backend/jest.config.js`:

```javascript
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/database/migrations/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']
};
```

### Frontend Configuration (Vitest)

Configuration is in `frontend/vite.config.test.ts`:

```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/tests/setup.ts',
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  }
});
```

## Environment Variables

### Backend Test Environment

Test environment variables are automatically set in the test setup:

```javascript
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.DATABASE_URL = ':memory:'; // SQLite in-memory database
```

### Frontend Test Environment

Mock environment variables are configured in the test setup:

```javascript
window.env = {
  VITE_API_URL: 'http://localhost:8080',
  VITE_ENVIRONMENT: 'test'
};
```

## Test Data and Mocks

### Backend Test Data

The backend tests use factory functions for consistent test data:

```javascript
const createTestUser = (overrides = {}) => ({
  id: 123,
  username: 'testuser',
  email: 'test@example.com',
  role: 'admin',
  ...overrides
});
```

### Frontend Test Data

The frontend tests use mock services and data factories:

```javascript
global.createMockUser = (overrides = {}) => ({
  id: 123,
  username: 'testuser',
  email: 'test@example.com',
  role: 'admin',
  active: true,
  ...overrides
});
```

## Debugging Tests

### Backend Debugging

1. Add debug logs:
```javascript
console.log('Debug info:', variable);
```

2. Run specific test with debug output:
```bash
npm test -- --verbose tests/ai.test.js
```

3. Use Node.js debugger:
```bash
node --inspect-brk node_modules/.bin/jest tests/ai.test.js
```

### Frontend Debugging

1. Use React Testing Library debug:
```javascript
import { render, screen } from '@testing-library/react';

it('should debug component', () => {
  render(<Component />);
  screen.debug(); // Prints the DOM
});
```

2. Run tests with UI for interactive debugging:
```bash
npm run test:ui
```

3. Add console logs in components:
```javascript
console.log('Component state:', state);
```

## Common Issues and Solutions

### Backend Issues

**Issue**: Database connection errors in tests
**Solution**: Ensure test environment uses in-memory SQLite database

**Issue**: JWT token validation failing
**Solution**: Check that test setup includes valid JWT_SECRET

**Issue**: Mock not working properly
**Solution**: Verify mock setup in `tests/setup.js`

### Frontend Issues

**Issue**: Component not rendering in tests
**Solution**: Check that all required providers are wrapped around component

**Issue**: Event handlers not firing
**Solution**: Use `await user.click()` with proper async/await

**Issue**: API calls not being mocked
**Solution**: Verify mock setup in `src/tests/setup.ts`

### Environment Issues

**Issue**: Tests failing only in CI/CD
**Solution**: Ensure all environment variables are set in CI configuration

**Issue**: Coverage reports not generating
**Solution**: Check that coverage directories have write permissions

## Continuous Integration

### Running Tests in CI/CD

Add these commands to your CI/CD pipeline:

```bash
# Backend tests
cd backend && npm ci && npm test

# Frontend tests (after dependencies are added)
cd frontend && npm ci && npm test

# Generate coverage reports
cd backend && npm test -- --coverage
cd frontend && npm run test:coverage
```

### Coverage Thresholds

Consider setting coverage thresholds in your test configuration:

**Backend** (in `jest.config.js`):
```javascript
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80
  }
}
```

**Frontend** (in `vite.config.test.ts`):
```typescript
coverage: {
  thresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
}
```

## Best Practices

1. **Test Isolation**: Each test should be independent and not affect other tests
2. **Descriptive Names**: Use clear, descriptive test names that explain what is being tested
3. **Arrange-Act-Assert**: Structure tests with clear setup, action, and verification phases
4. **Mock External Dependencies**: Mock API calls, database operations, and external services
5. **Test Edge Cases**: Include tests for error conditions and boundary values
6. **Keep Tests Fast**: Use mocks and in-memory databases to keep tests running quickly
7. **Test User Behavior**: Focus on testing how users interact with the application
8. **Maintain Tests**: Update tests when code changes to prevent false positives/negatives

## Quick Reference

### Backend Commands
```bash
npm test                          # Run all tests
npm test -- --watch              # Watch mode
npm test -- --coverage           # With coverage
npm test -- tests/ai.test.js     # Specific file
```

### Frontend Commands
```bash
npm test                          # Run all tests
npm test -- --watch              # Watch mode
npm run test:ui                   # UI mode
npm run test:coverage             # With coverage
npm test -- AISettingsModal      # Specific test
```

### Coverage Reports
- **Backend**: `backend/coverage/lcov-report/index.html`
- **Frontend**: `frontend/coverage/index.html`