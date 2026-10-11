// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // `useRef(new Animated.Value(0)).current` is React Native's standard animation
      // setup; these React Compiler checks flag it everywhere. The app doesn't use the compiler.
      'react-hooks/refs': 'off',
      // Resetting a sheet's state each time it opens is intentional.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
