/** One Android version code per year-based release, independent of CI runs. */
export function releaseVersionCode(version) {
  const match = /^(20\d{2})-([1-9]\d{0,3})$/.exec(version);
  if (!match) throw new Error('Use a year-minor version, for example 2026-7.');
  return Number(match[1]) * 10000 + Number(match[2]);
}

export function validateReleaseIdentity(app, toolingVersion) {
  const versionCode = releaseVersionCode(app.version);
  if (app.android.versionCode !== versionCode) throw new Error('app.json versionCode must match the year-minor version.');
  if (toolingVersion !== `${app.version.replace('-', '.')}.0`) throw new Error('package.json version must match app.json.');
  if (app.android.package !== 'ninja.domi.cloudhoist') throw new Error('Keep the existing Android package identity.');
  return { version: app.version, versionCode, unsignedApk: `dist/cloud-hoist-${app.version}-unsigned.apk`, apk: `dist/cloud-hoist-${app.version}.apk` };
}
