(() => {
  const firebaseConfig = {
    apiKey: 'AIzaSyCqMH6_r6d0FrJsWGAIDW8Gk5L-cRdF9uI',
    authDomain: 'project-quan-cafe.firebaseapp.com',
    projectId: 'project-quan-cafe',
    storageBucket: 'project-quan-cafe.firebasestorage.app',
    messagingSenderId: '934988771368',
    appId: '1:934988771368:web:e3355cbad098d081dd451d',
    measurementId: 'G-8YTXYJLB6K'
  };

  try {
    const storedConfig = localStorage.getItem('mocha_firebase_config');
    if (storedConfig) Object.assign(firebaseConfig, JSON.parse(storedConfig));
  } catch (error) {
    console.warn('[Firebase Config] Could not read localStorage config.', error);
  }

  window.FIREBASE_CONFIG = { ...firebaseConfig, ...window.FIREBASE_CONFIG };
})();
