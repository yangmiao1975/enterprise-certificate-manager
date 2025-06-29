/**
 * Jest Test Setup
 * Global test configuration and utilities
 */

import { jest } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.DATABASE_URL = 'sqlite://./test.db';
process.env.AI_KEY_ENCRYPTION_SECRET = 'test-encryption-key';
process.env.GCP_PROJECT_ID = 'test-project';

// Mock console to reduce noise during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Global test utilities
global.createMockUser = (overrides = {}) => ({
  id: 123,
  username: 'testuser',
  email: 'test@example.com',
  role: 'admin',
  active: true,
  ...overrides
});

global.createMockAIProvider = (provider = 'openai', overrides = {}) => ({
  provider,
  apiKey: `sk-test-${provider}-key`,
  isActive: true,
  addedAt: new Date().toISOString(),
  ...overrides
});

// Setup and teardown hooks
beforeAll(async () => {
  // Global setup
});

afterAll(async () => {
  // Global cleanup
});

beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
});