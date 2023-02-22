import type { Config } from 'jest'

const config: Config = {
  testEnvironment: 'node',
  verbose: false,

  projects: [
    {
      displayName: 'micro',
      testMatch: ['<rootDir>/src/**/*.micro.ts'],
      preset: 'ts-jest',
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/src/**/*.integration.ts'],
      preset: 'ts-jest',
      slowTestThreshold: 20000
    }
  ]
}

export default config