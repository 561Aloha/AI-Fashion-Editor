// firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCuBNjxzKdeGnab2R1duvLyXCD_YXNK9nQ",
  authDomain: "ai-fashion-5e30a.firebaseapp.com",
  projectId: "ai-fashion-5e30a",
  storageBucket: "ai-fashion-5e30a.firebasestorage.app",
  messagingSenderId: "535622765461",
  appId: "1:535622765461:web:e8a127ee1a59bb65d1049c",
  measurementId: "G-TJQX3S46V0",
};


const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Analytics is optional; guard it so it doesn't explode in SSR/test
if (typeof window !== "undefined") {
  isAnalyticsSupported().then((supported) => {
    if (supported) {
      getAnalytics(app);
    }
  });
}

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
