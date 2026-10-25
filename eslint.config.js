import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import prettier from 'eslint-config-prettier'

const noSessionStorage = [
  {
    object: 'sessionStorage',
    message: 'Only keyStore.js and persistence.js may use sessionStorage',
  },
  {
    object: 'globalThis',
    property: 'sessionStorage',
    message: 'Only keyStore.js and persistence.js may use sessionStorage',
  },
  {
    object: 'window',
    property: 'sessionStorage',
    message: 'Only keyStore.js and persistence.js may use sessionStorage',
  },
]
const noLocalStorage = [
  { object: 'localStorage', message: 'Do not use localStorage (see DECISIONS D11/D12)' },
]
const noFocusedTests = ['describe', 'it', 'test'].flatMap((object) =>
  ['only', 'skip'].map((property) => ({
    object,
    property,
    message: 'Remove .only/.skip before committing',
  })),
)

const clientFiles = ['client/**/*.{js,jsx}']

export default [
  { ignores: ['dist', '.superpowers', '.playwright-mcp', 'coverage', 'fixtures'] },
  js.configs.recommended,
  {
    rules: {
      'no-unused-vars': 'error',
      'no-unreachable': 'error',
      'no-unused-private-class-members': 'error',
      // The API key travels in headers and bodies, so they must never reach a log call.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.name=/^(console|log)$/] MemberExpression[object.name='req'][property.name=/^(headers|body)$/]",
          message: 'Never log request headers or bodies: they can contain the API key.',
        },
      ],
      'no-restricted-properties': ['error', ...noLocalStorage, ...noSessionStorage],
    },
  },
  {
    files: clientFiles,
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-console': 'error',
      // Core ESLint does not see <Component /> as a use of the import (same as the Vite template).
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  { files: clientFiles, ...reactHooks.configs.flat.recommended },
  { files: clientFiles, ...reactRefresh.configs.vite },
  { files: clientFiles, ...jsxA11y.flatConfigs.recommended },
  {
    files: ['server/**/*.js', 'api/**/*.js', '*.config.js'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'warn' },
  },
  {
    // These two files are the only places allowed to touch sessionStorage (DECISIONS D11/D12).
    files: ['client/src/api/keyStore.js', 'client/src/lesson/persistence.js'],
    rules: { 'no-restricted-properties': ['error', ...noLocalStorage] },
  },
  {
    files: ['**/*.test.js'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...noLocalStorage,
        ...noSessionStorage,
        ...noFocusedTests,
      ],
    },
  },
  prettier,
]
