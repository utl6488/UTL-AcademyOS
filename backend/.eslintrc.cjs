/** Backend-scoped ESLint config. Extends the monorepo root. */
module.exports = {
  root: false,
  extends: ['../.eslintrc.cjs'],
  env: {
    node: true,
    es2023: true,
  },
  rules: {
    'no-console': 'error',
    // Noisy for CJS-first libs (argon2, jsonwebtoken, pino, rate-limit-redis)
    // where default-import is the documented pattern even though the module
    // also exposes named exports.
    'import/no-named-as-default-member': 'off',
    'import/no-named-as-default': 'off',
  },
  ignorePatterns: ['dist/', 'coverage/', 'prisma/migrations/', '**/*.d.ts'],
};
