// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Enable require.context so asset directories (e.g. daily reflection images)
// can be auto-discovered instead of listed one-by-one.
config.transformer.unstable_allowRequireContext = true;

module.exports = config;
