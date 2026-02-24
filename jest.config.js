const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

// Custom Jest configuration
const customJestConfig = {
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
};

// Create config for each project
module.exports = async () => {
  const nextJestConfig = await createJestConfig(customJestConfig)();

  return {
    ...nextJestConfig,
    projects: [
      {
        ...nextJestConfig,
        displayName: 'unit',
        testEnvironment: 'jest-environment-jsdom',
        testMatch: [
          '<rootDir>/__tests__/calculations.test.ts',
          '<rootDir>/__tests__/sensitivity.test.ts',
          '<rootDir>/__tests__/calculations-edge.test.ts',
          '<rootDir>/__tests__/report.test.ts',
        ],
        setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      },
      {
        ...nextJestConfig,
        displayName: 'api',
        testEnvironment: 'node',
        testMatch: ['<rootDir>/__tests__/api/**/*.test.ts'],
        setupFilesAfterEnv: ['<rootDir>/jest.setup.api.js'],
      },
      {
        ...nextJestConfig,
        displayName: 'lib',
        testEnvironment: 'node',
        testMatch: ['<rootDir>/__tests__/lib/**/*.test.ts'],
      },
    ],
  };
};
