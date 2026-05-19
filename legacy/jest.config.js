module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: ['./jest.setup.js'],
  transform: {
    '\\.jsx?$': 'babel-jest',
  },
  transformIgnorePatterns: [
    '/node_modules/',
  ],
  collectCoverageFrom: [
    'src/**/*.jsx',
    '!src/ios-frame.jsx',
    '!src/tweaks-panel.jsx',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['html', 'text', 'text-summary'],
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
  ],
};
