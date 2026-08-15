module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // Must stay last — Reanimated 4 / Worklets babel transform.
      'react-native-worklets/plugin',
    ],
  };
};
