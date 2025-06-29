export default {
  // Test environment
  testEnvironment: 'node',
  
  // ES Module support
  preset: null,
  transform: {},

  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],

  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js', // Exclude main entry point
    '!src/**/*.config.js', // Exclude config files
    '!src/**/migrations/**', // Exclude database migrations
  ],
  
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  // Setup and teardown
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Test timeout
  testTimeout: 10000,

  // Mock configuration
  clearMocks: true,
  restoreMocks: true,

  // Verbose output
  verbose: true,

  // Module file extensions
  moduleFileExtensions: ['js', 'json'],

  // Force exit after tests
  forceExit: true,

  // Detect open handles
  detectOpenHandles: true,
};