/**
 * Vitest Test Setup
 * Global test configuration for React Testing Library
 */

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables
Object.defineProperty(window, 'env', {
  value: {
    VITE_API_URL: 'http://localhost:8080',
    VITE_ENVIRONMENT: 'test'
  },
  writable: true
});

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn()
  },
  writable: true
});

// Mock fetch for API calls
global.fetch = vi.fn();

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock console methods to reduce noise during tests
const originalConsole = { ...console };
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: originalConsole.error // Keep error for debugging
};

// Clean up after each test
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

// Global test utilities
global.createMockUser = (overrides = {}) => ({
  id: 123,
  username: 'testuser',
  email: 'test@example.com',
  role: 'admin',
  active: true,
  ...overrides
});

global.createMockAISettings = (overrides = {}) => ({
  primaryProvider: null,
  fallbackProvider: null,
  usePersonalKeys: false,
  providers: [],
  ...overrides
});