/* eslint-env node */
const { versionInfo } = require('./scripts/release.cjs');

module.exports = ({ config }) => {
  const target = process.env.DUSK_BUILD_TARGET || (process.env.EXPO_TV === '1' ? 'android-tv' : 'android');
  if (!['android', 'android-tv'].includes(target)) throw new Error('Invalid DUSK_BUILD_TARGET');
  const { version, versionCode } = versionInfo(process.env.DUSK_RELEASE_VERSION || require('./package.json').version);
  return {
    ...config,
    version,
    android: {
      ...config.android,
      versionCode,
      permissions: [...(config.android.permissions || []), 'android.permission.REQUEST_INSTALL_PACKAGES'],
    },
    plugins: [
      ...config.plugins.map(plugin => Array.isArray(plugin) && plugin[0] === '@react-native-tvos/config-tv'
        ? [plugin[0], { ...plugin[1], isTV: target === 'android-tv' }]
        : plugin),
      './plugins/withAndroidRelease.cjs',
    ],
    extra: { ...config.extra, buildTarget: target },
  };
};
