const { withAndroidManifest } = require('@expo/config-plugins');

// Marks this app's own release-type builds (preview/production) as
// profileable via Android Studio's Profiler, independent of the device's
// own "Enable profileable applications on shell" developer option — some
// OEM Android skins (confirmed: a realme/ColorOS Android 15 device used
// for testing this app) don't expose that toggle in Developer Options at
// all, which otherwise silently prevents a release build from ever
// appearing in the Profiler's process list, even while stock Google apps
// (which ship their own <profileable> tag) do show up.
//
// android:shell="true" only allows profiling via adb/Android Studio — it
// does NOT make the app profileable by arbitrary other apps on the
// device, so this is safe to ship in a real release build, not just a
// dev-only debug build.
function withAndroidProfileable(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) return config;

    application.profileable = application.profileable || [];
    const alreadyPresent = application.profileable.some(
      (entry) => entry && entry.$ && entry.$['android:shell'] !== undefined
    );
    if (!alreadyPresent) {
      application.profileable.push({ $: { 'android:shell': 'true' } });
    }
    return config;
  });
}

module.exports = withAndroidProfileable;
