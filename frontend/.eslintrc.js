module.exports = {
    parser: 'vue-eslint-parser', // Use vue-eslint-parser for Vue files
    parserOptions: {
      parser: '@babel/eslint-parser', // Use @babel/eslint-parser for JavaScript
      requireConfigFile: false, // Disable Babel config file lookup
      ecmaVersion: 2021, // Use the latest ECMAScript version
      sourceType: 'module', // Use ES modules
    },
    extends: [
      'plugin:vue/recommended', // Use recommended Vue.js rules
      'eslint:recommended', // Use recommended ESLint rules
    ],
    rules: {
      // Custom rules
      'no-console': 'warn',
      'vue/multi-word-component-names': 'off', // Disable multi-word component names rule
    },
  };