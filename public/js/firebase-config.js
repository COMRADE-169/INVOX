window.isFirebaseConfigured = function () {
  const config = window.INVOX_FIREBASE_CONFIG || {};
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
};

window.InvoxFirebaseReady = Promise.resolve().then(() => {
  if (!window.isFirebaseConfigured()) return null;
  if (!window.firebase) throw new Error('Firebase SDK failed to load.');
  const app = window.firebase.apps.length
    ? window.firebase.app()
    : window.firebase.initializeApp(window.INVOX_FIREBASE_CONFIG);
  window.firebase.firestore().settings({ ignoreUndefinedProperties: true });
  return app;
});
