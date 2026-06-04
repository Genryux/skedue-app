const { withAndroidManifest } = require('@expo/config-plugins');

const PERMISSIONS = [
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.POST_NOTIFICATIONS',
];

module.exports = function withAndroidPermissions(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }
    const existingPermissions = manifest['uses-permission'];
    const existingNames = new Set(
      existingPermissions.map((p) => p['$']['android:name']),
    );
    for (const permission of PERMISSIONS) {
      if (!existingNames.has(permission)) {
        existingPermissions.push({
          $: { 'android:name': permission },
        });
      }
    }
    return modConfig;
  });
};
