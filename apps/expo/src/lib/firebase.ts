import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase configuration
// Replace these with your actual Firebase project config
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "placeholder-api-key",
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    "placeholder.firebaseapp.com",
  projectId:
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "placeholder-project",
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    "placeholder.appspot.com",
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "000000000000",
  appId:
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID ??
    "1:000000000000:web:placeholder",
};

// Initialize Firebase (avoid re-initializing in hot reload)
const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!;

export const db = getFirestore(app);
export const storage = getStorage(app);
