import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import prettier from 'eslint-config-prettier'

const sessionMsg = 'Only keyStore.js and persistence.js may use sessionStorage'
const localMsg = 'Do not use localStorage (see DECISIONS D11/D12)'
// Bare identifiers (also catches `const s = sessionStorage`).
const noLocalGlobal = [{ name: 'localStorage', message: localMsg }]
const noSessionGlobal = [{ name: 'sessionStorage', message: sessionMsg }]
// Explicit `window.x` / `globalThis.x` forms.
const noLocalProps = ['window', 'globalThis'].map((object) => ({
  object,
  property: 'localStorage',
  message: localMsg,
}))
const noSessionProps = ['window', 'globalThis'].map((object) => ({
  object,
  property: 'sessionStorage',
  message: sessionMsg,
}))
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
            "CallExpression[callee.object.name=/^(console|log|logger)$/] MemberExpression[object.name='req'][property.name=/^(headers|body)$/]",
          message: 'Never log request headers or bodies: they can contain the API key.',
        },
      ],
      'no-restricted-globals': ['error', ...noLocalGlobal, ...noSessionGlobal],
      'no-restricted-properties': ['error', ...noLocalProps, ...noSessionProps],
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
      // ignoreRestSiblings: `const { node, ...props } = x` is how a prop is left out of a spread.
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', ignoreRestSiblings: true }],
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
    files: ['**/*.test.js'],
    rules: {
      'no-restricted-properties': ['error', ...noLocalProps, ...noSessionProps, ...noFocusedTests],
    },
  },
  {
    // Must stay after the test block. These modules (and their tests) are the only places
    // allowed to touch sessionStorage (DECISIONS D11/D12); localStorage and focused tests stay banned.
    files: ['client/src/api/keyStore{,.test}.js', 'client/src/lesson/persistence{,.test}.js'],
    rules: {
      'no-restricted-globals': ['error', ...noLocalGlobal],
      'no-restricted-properties': ['error', ...noLocalProps, ...noFocusedTests],
    },
  },
  prettier,
]
