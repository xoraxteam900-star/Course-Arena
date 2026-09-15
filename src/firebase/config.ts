import { initializeApp, getApps, getApp } from "firebase/app";
// @ts-ignore
import * as FirebaseAuth from "firebase/auth";
// @ts-ignore
import * as AtFirebaseAuth from "@firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore, setLogLevel } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const getPersistence = () => {
  try {
    if (typeof (FirebaseAuth as any).getReactNativePersistence === "function") {
      return (FirebaseAuth as any).getReactNativePersistence(AsyncStorage);
    }
  } catch {}
  try {
    if (typeof (AtFirebaseAuth as any).getReactNativePersistence === "function") {
      return (AtFirebaseAuth as any).getReactNativePersistence(AsyncStorage);
    }
  } catch {}
  try {
    const rnAuth = require("@firebase/auth/dist/rn/index.js");
    if (typeof rnAuth.getReactNativePersistence === "function") {
      return rnAuth.getReactNativePersistence(AsyncStorage);
    }
  } catch {}
  return undefined;
};

export const auth =
  Platform.OS === "web"
    ? FirebaseAuth.getAuth(app)
    : (() => {
        try {
          const persistence = getPersistence();
          if (persistence) {
            return FirebaseAuth.initializeAuth(app, { persistence });
          }
          return FirebaseAuth.initializeAuth(app);
        } catch (error: any) {
          // initializeAuth throws if already called (e.g. fast refresh / reload)
          return FirebaseAuth.getAuth(app);
        }
      })();

export const db = getFirestore(app);
try {
  setLogLevel("silent");
} catch {}
export const storage = getStorage(app);

export const FUNCTIONS_BASE_URL = process.env.EXPO_PUBLIC_FUNCTIONS_BASE_URL || "";
