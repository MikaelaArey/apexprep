// Integration tests against the local Supabase stand-in. Run: npm run test:sync
// Plain Node environment (no React Native preset) so the real fetch is used.
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests-integration'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transform: { '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
  transformIgnorePatterns: ['/node_modules/(?!(ts-fsrs)/)'],
};
