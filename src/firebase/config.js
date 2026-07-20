import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore/lite";

export const firebaseConfig = {
  apiKey: "AIzaSyCcScEqYQedKiNv6rj-KEphUF8EI5Z8Zmc",
  authDomain: "hilal-club-web-app.firebaseapp.com",
  projectId: "hilal-club-web-app",
  storageBucket: "hilal-club-web-app.firebasestorage.app",
  messagingSenderId: "762832421345",
  appId: "1:762832421345:web:e90ed6746acfe8355252a0",
  measurementId: "G-L8XJ57Y3SW",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
