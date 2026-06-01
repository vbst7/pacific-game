import { initializeApp } from "firebase/app";
import { initializeFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Use initializeFirestore to force long polling, which fixes the Write/channel failure on localhost
const db = initializeFirestore(app, { experimentalForceLongPolling: true });

const auth = getAuth(app);

// Connect to Emulators if running locally
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  // Connect Firestore to local port 8080
  connectFirestoreEmulator(db, "localhost", 8080);
  
  console.log("Logged into local Firebase Emulator Suite");
}

export { db, auth };
