const { getDefaultConfig } = require('expo/metro-config');

// DuskTV is a standalone app. Watching two levels above the project scans the
// user's entire workspace and can exhaust Metro's heap before bundling starts.
// eslint-disable-next-line no-undef
const config = getDefaultConfig(__dirname);
// The browser preview has its own React installation and bundler.
config.resolver.blockList = /[\\/]preview[\\/].*/;
module.exports = config;
