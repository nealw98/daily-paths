// Config plugin: let MainActivity handle font-size and fold/unfold changes
// itself.
//
// Why: Expo's default android:configChanges omits `fontScale`, so changing the
// phone's font size (Settings → Display → Font size) makes Android destroy and
// recreate MainActivity. For a React Native app that is a full restart —
// splash, subscription gate, back to Today — losing whatever screen the user
// was on (found in Hands Off's Android testing). With `fontScale` declared, the
// activity stays alive and React Native picks the new scale up from the
// configuration change instead.
//
// `smallestScreenSize` is the same story for foldables: opening or closing a
// Galaxy Fold / Pixel Fold changes the smallest screen width, which Expo's
// default list doesn't cover, so every fold or unfold restarted the app.
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const HANDLED = ['fontScale', 'smallestScreenSize'];

module.exports = function withFontScaleConfigChange(config) {
  return withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    const current = (activity.$['android:configChanges'] || '').split('|').filter(Boolean);
    for (const change of HANDLED) if (!current.includes(change)) current.push(change);
    activity.$['android:configChanges'] = current.join('|');
    return cfg;
  });
};
