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
        testMatch: ['<rootDir>/__tests__/calculations.test.ts'],
        setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      },
      {
        ...nextJestConfig,
        displayName: 'api',
        testEnvironment: 'node',
        testMatch: ['<rootDir>/__tests__/api/**/*.test.ts'],
        setupFilesAfterEnv: ['<rootDir>/jest.setup.api.js'],
      },
    ],
  };
};
