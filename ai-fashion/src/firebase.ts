// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, GoogleAuthProvider } from "firebase/auth";  // ADD THIS

const firebaseConfig = {
  apiKey: "AIzaSyCuBNjxzKdeGnab2R1duvLyXCD_YXNK9nQ",
  authDomain: "ai-fashion-5e30a.firebaseapp.com",
  projectId: "ai-fashion-5e30a",
  storageBucket: "ai-fashion-5e30a.firebasestorage.app",
  messagingSenderId: "535622765461",
  appId: "1:535622765461:web:e8a127ee1a59bb65d1049c",
  measurementId: "G-TJQX3S46V0"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const db = getFirestore(app);
export const storage = getStorage(app);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();