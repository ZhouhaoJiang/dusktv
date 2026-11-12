const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { versionInfo, createManifest } = require('./release.cjs');

test('version codes increase across patch, minor and major releases', () => {
  const versions = ['0.1.0', '0.1.1', '0.2.0', '1.0.0'];
  assert.deepEqual(versions.map(v => versionInfo(v).versionCode), [1000, 1001, 2000, 1000000]);
  for (const invalid of ['v1.0.0-beta', '1.0', '01.0.0', '0.0.0', '1.1000.0', '2101.0.0', 'v1.0.0;echo x']) {
    assert.throws(() => versionInfo(invalid));
  }
});
test('manifest requires both APKs and records their digests and versioned URLs', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dusktv-manifest-'));
  try {
    assert.throws(() => createManifest('1.2.3', directory, 'owner/repo'));
    for (const target of ['android', 'android-tv']) fs.writeFileSync(path.join(directory, `dusktv-${target}-v1.2.3.apk`), 'test apk');
    const manifest = createManifest('1.2.3', directory, 'owner/repo');
    assert.equal(manifest.versionCode, 1002003);
    assert.equal(manifest.targets.android.size, 8);
    assert.match(manifest.targets['android-tv'].url, /\/v1\.2\.3\/dusktv-android-tv-v1\.2\.3.apk$/);
    assert.match(manifest.targets.android.sha256, /^[a-f0-9]{64}$/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
test('config sets phone and TV targets independently of device screen size', () => {
  const config = require('../app.json').expo;
  const configure = require('../app.config.js');
  for (const target of ['android', 'android-tv']) {
    process.env.DUSK_BUILD_TARGET = target;
    process.env.DUSK_RELEASE_VERSION = '1.2.3';
    const result = configure({ config });
    assert.equal(result.extra.buildTarget, target);
    assert.equal(result.android.versionCode, 1002003);
    assert.equal(result.plugins[0][1].isTV, target === 'android-tv');
    assert.ok(result.android.permissions.includes('android.permission.REQUEST_INSTALL_PACKAGES'));
  }
  delete process.env.DUSK_BUILD_TARGET;
  delete process.env.DUSK_RELEASE_VERSION;
});
