module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: [
      "react-native-worklets/plugin",
      [
        "module-resolver",
        {
          alias: {
            "@workspace/api-client-react": "./src/api-client/index",
          },
        },
      ],
    ],
  };
};
