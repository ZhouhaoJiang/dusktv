/* eslint-env node */
const { withAndroidManifest, withAppBuildGradle, AndroidConfig } = require('expo/config-plugins');

module.exports = function withAndroidRelease(config) {
  config = withAndroidManifest(config, config => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    application.$['android:usesCleartextTraffic'] = 'true';
    return config;
  });
  const signRelease = process.env.DUSK_RELEASE_BUILD === '1';
  for (const name of ['ANDROID_KEYSTORE_PATH', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD']) {
    if (signRelease && !process.env[name]) throw new Error(`Missing release signing environment variable: ${name}`);
  }
  return withAppBuildGradle(config, config => {
    // RN 0.74 only filters prebuilt JNI libraries automatically with the new architecture.
    // Match packaged ABIs to the architectures actually compiled for the old architecture too.
    const source = config.modResults.contents.replace('defaultConfig {', `defaultConfig {
        ndk {
            abiFilters.addAll((project.findProperty('reactNativeArchitectures') ?: 'armeabi-v7a,arm64-v8a').split(',').toList())
        }`);
    if (!signRelease) { config.modResults.contents = source; return config; }
    const marker = 'signingConfigs {';
    const releaseBlock = /(release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
    if (!source.includes(marker) || !releaseBlock.test(source)) throw new Error('Unsupported Gradle signing template');
    config.modResults.contents = source.replace(releaseBlock, '$1signingConfig signingConfigs.release').replace(marker, `${marker}
        release {
            storeFile file(System.getenv('ANDROID_KEYSTORE_PATH'))
            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
            keyAlias System.getenv('ANDROID_KEY_ALIAS')
            keyPassword System.getenv('ANDROID_KEY_PASSWORD')
        }`);
    return config;
  });
};
