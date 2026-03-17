module.exports = {
  extends: ['next/core-web-vitals'],
  rules: {
    // General rules
    'prefer-const': 'error',
    'no-var': 'error',
    'no-console': 'warn',
    
    // Next.js specific
    '@next/next/no-html-link-for-pages': 'off',
  },
  ignorePatterns: [
    '.next/',
    'out/',
    'dist/',
    'build/',
    'node_modules/',
    'coverage/',
    '*.config.js',
    '*.config.ts',
  ],
};
