import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/firebase/config";

export type IosNavbarTemplate = "ios-pill" | "ios-island" | "ios-minimal";
export type AndroidNavbarTemplate = "android-unified" | "android-flat" | "android-floating";

export interface NavbarConfig {
  iosTemplate: IosNavbarTemplate;
  androidTemplate: AndroidNavbarTemplate;
  lastUpdated: any; // Firestore timestamp
}

const CONFIG_DOC_PATH = "platformSettings/navbar";

export const defaultNavbarConfig: NavbarConfig = {
  iosTemplate: "ios-pill",
  androidTemplate: "android-unified",
  lastUpdated: new Date(),
};

/**
 * Listen to real-time navbar config changes
 */
export function listenToNavbarConfig(onUpdate: (config: NavbarConfig) => void) {
  const docRef = doc(db, CONFIG_DOC_PATH);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as NavbarConfig);
      } else {
        onUpdate(defaultNavbarConfig);
      }
    },
    (err) => {
      console.warn("Failed to listen to navbar config:", err);
    }
  );
}

/**
 * Fetch navbar config exactly once
 */
export async function getNavbarConfig(): Promise<NavbarConfig> {
  try {
    const docRef = doc(db, CONFIG_DOC_PATH);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as NavbarConfig;
    }
  } catch (err) {
    console.warn("Failed to get navbar config:", err);
  }
  return defaultNavbarConfig;
}

/**
 * Save navbar config (Admin only)
 */
export async function saveNavbarConfig(config: Partial<NavbarConfig>) {
  const docRef = doc(db, CONFIG_DOC_PATH);
  await setDoc(docRef, { ...config, lastUpdated: new Date() }, { merge: true });
}
