import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "@/firebase/config";

export interface PlatformFeaturesConfig {
  enableGifting: boolean; // default: true
  enableChat: boolean;    // default: true
}

export type PlatformFeatures = PlatformFeaturesConfig;

export const defaultPlatformFeatures: PlatformFeaturesConfig = {
  enableGifting: true,
  enableChat: true,
};

const FEATURES_DOC = "platformSettings/features";
const CACHE_KEY = "@platform_features_config";

export function listenToPlatformFeatures(onUpdate: (features: PlatformFeaturesConfig) => void) {
  AsyncStorage.getItem(CACHE_KEY).then((cached) => {
    if (cached) {
      try {
        onUpdate({ ...defaultPlatformFeatures, ...JSON.parse(cached) });
      } catch {}
    }
  });

  return onSnapshot(doc(db, FEATURES_DOC), (snap) => {
    if (snap.exists()) {
      const data = snap.data() as Partial<PlatformFeaturesConfig>;
      const merged: PlatformFeaturesConfig = {
        enableGifting: typeof data.enableGifting === "boolean" ? data.enableGifting : true,
        enableChat: typeof data.enableChat === "boolean" ? data.enableChat : true,
      };
      onUpdate(merged);
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(merged)).catch(() => {});
    } else {
      onUpdate(defaultPlatformFeatures);
    }
  });
}

export async function getPlatformFeatures(): Promise<PlatformFeaturesConfig> {
  try {
    const snap = await getDoc(doc(db, FEATURES_DOC));
    if (snap.exists()) {
      const data = snap.data() as Partial<PlatformFeaturesConfig>;
      return {
        enableGifting: typeof data.enableGifting === "boolean" ? data.enableGifting : true,
        enableChat: typeof data.enableChat === "boolean" ? data.enableChat : true,
      };
    }
  } catch {}
  return defaultPlatformFeatures;
}

export async function savePlatformFeatures(features: Partial<PlatformFeaturesConfig>): Promise<void> {
  await setDoc(doc(db, FEATURES_DOC), features, { merge: true });
  const current = await getPlatformFeatures();
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(current)).catch(() => {});
}
