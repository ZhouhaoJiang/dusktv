/* eslint-env node */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function versionInfo(input) {
  const match = /^(?:v)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(input);
  if (!match) throw new Error('Use a stable version/tag such as v0.1.0');
  const [major, minor, patch] = match.slice(1).map(Number);
  const versionCode = major * 1000000 + minor * 1000 + patch;
  if (minor > 999 || patch > 999 || !Number.isSafeInteger(versionCode) || versionCode < 1 || versionCode > 2100000000) {
    throw new Error('Version exceeds Android versionCode limits (minor/patch must be <= 999)');
  }
  return { version: `${major}.${minor}.${patch}`, versionCode };
}

function createManifest(version, directory, repository) {
  const info = versionInfo(version);
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Invalid GitHub repository');
  const targets = {};
  for (const target of ['android', 'android-tv']) {
    const name = `dusktv-${target}-v${info.version}.apk`;
    const bytes = fs.readFileSync(path.join(directory, name));
    if (!bytes.length) throw new Error(`Empty APK: ${name}`);
    targets[target] = {
      url: `https://github.com/${repository}/releases/download/v${info.version}/${name}`,
      size: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    };
  }
  return { schemaVersion: 1, ...info, targets };
}

module.exports = { versionInfo, createManifest };
if (require.main === module) {
  const [command, input, directory, repository] = process.argv.slice(2);
  if (command === 'version') {
    const info = versionInfo(input);
    if (input !== `v${info.version}`) throw new Error('Release tags must start with v');
    process.stdout.write(`version=${info.version}\n`);
  } else if (command === 'manifest') {
    fs.writeFileSync(path.join(directory, 'update.json'), JSON.stringify(createManifest(input, directory, repository), null, 2) + '\n');
  } else {
    throw new Error('Usage: release.cjs version TAG | manifest VERSION DIRECTORY OWNER/REPO');
  }
}
