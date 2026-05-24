const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add 'wasm' to resolver asset extensions to support expo-sqlite on web
config.resolver.assetExts.push('wasm');

module.exports = config;
