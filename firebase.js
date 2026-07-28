const firebaseConfig = {
  apiKey: "AIzaSyCUQcaDwTMzKPlxK5WCIXwuamVIuHNmna4",
  authDomain: "mochaandmiso.firebaseapp.com",
  projectId: "mochaandmiso",
  storageBucket: "mochaandmiso.firebasestorage.app",
  messagingSenderId: "683827731019",
  appId: "1:683827731019:web:eec921049f6fe4aa160bce"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();

window.firebaseDb = db;
window.firebaseAuth = auth;
window.db = db;