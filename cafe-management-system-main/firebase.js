const firebaseConfig = window.FIREBASE_CONFIG || {
  apiKey: "AIzaSyCqMH6_r6d0FrJsWGAIDW8Gk5L-cRdF9uI",
  authDomain: "project-quan-cafe.firebaseapp.com",
  projectId: "project-quan-cafe",
  storageBucket: "project-quan-cafe.firebasestorage.app",
  messagingSenderId: "934988771368",
  appId: "1:934988771368:web:e3355cbad098d081dd451d",
  measurementId: "G-8YTXYJLB6K"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const app = firebase.app();
const db = firebase.firestore(app);
const auth = firebase.auth(app);
window.firebaseApp = app;
window.firebaseDb = db;
window.firebaseAuth = auth;
window.db = db;
window.firebaseProjectId = firebaseConfig.projectId;
