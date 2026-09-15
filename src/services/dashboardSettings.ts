import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "@/firebase/config";

export type CourseBoxPreset = "compact" | "standard" | "large" | "hero" | "custom";

export interface CourseBoxConfig {
  preset: CourseBoxPreset;
  cardWidth: number;      // Width in pixels (140 to 320)
  imageHeight: number;    // Height of the thumbnail (65 to 200)
  borderRadius: number;   // Corner radius (6 to 28)
  titleFontSize: number;  // Title font size (11 to 18)
  priceFontSize: number;  // Price font size (11 to 18)
  lastUpdated?: any;
}

export const COURSE_BOX_PRESETS: Record<Exclude<CourseBoxPreset, "custom">, Omit<CourseBoxConfig, "lastUpdated">> = {
  compact: {
    preset: "compact",
    cardWidth: 160,
    imageHeight: 85,
    borderRadius: 12,
    titleFontSize: 12,
    priceFontSize: 12,
  },
  standard: {
    preset: "standard",
    cardWidth: 200,
    imageHeight: 100,
    borderRadius: 16,
    titleFontSize: 14,
    priceFontSize: 13,
  },
  large: {
    preset: "large",
    cardWidth: 245,
    imageHeight: 125,
    borderRadius: 18,
    titleFontSize: 15,
    priceFontSize: 14,
  },
  hero: {
    preset: "hero",
    cardWidth: 290,
    imageHeight: 155,
    borderRadius: 22,
    titleFontSize: 16,
    priceFontSize: 15,
  },
};

export const defaultCourseBoxConfig: CourseBoxConfig = {
  ...COURSE_BOX_PRESETS.standard,
  lastUpdated: new Date(),
};

const CONFIG_DOC_PATH = "platformSettings/dashboard";
const CACHE_KEY = "@dashboard_course_box_config";

/**
 * Listen to real-time dashboard course box config updates from Firestore.
 * Automatically caches the latest config in AsyncStorage for instant offline start.
 */
export function listenToCourseBoxConfig(onUpdate: (config: CourseBoxConfig) => void) {
  // Load cached value first for immediate render without waiting for network
  AsyncStorage.getItem(CACHE_KEY)
    .then((cached) => {
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          onUpdate({ ...defaultCourseBoxConfig, ...parsed });
        } catch {}
      }
    })
    .catch(() => {});

  const docRef = doc(db, CONFIG_DOC_PATH);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<CourseBoxConfig>;
        const merged: CourseBoxConfig = {
          ...defaultCourseBoxConfig,
          ...data,
        };
        onUpdate(merged);
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(merged)).catch(() => {});
      } else {
        onUpdate(defaultCourseBoxConfig);
      }
    },
    (err) => {
      console.warn("Failed to listen to course box config:", err);
    }
  );
}

/**
 * Fetch course box config once (from cache or Firestore)
 */
export async function getCourseBoxConfig(): Promise<CourseBoxConfig> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      return { ...defaultCourseBoxConfig, ...JSON.parse(cached) };
    }
  } catch {}

  try {
    const docRef = doc(db, CONFIG_DOC_PATH);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as Partial<CourseBoxConfig>;
      const merged = { ...defaultCourseBoxConfig, ...data };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (err) {
    console.warn("Failed to get course box config from Firestore:", err);
  }

  return defaultCourseBoxConfig;
}

/**
 * Save course box config (Admin only)
 */
export async function saveCourseBoxConfig(config: Partial<CourseBoxConfig>): Promise<void> {
  const docRef = doc(db, CONFIG_DOC_PATH);
  const updated = {
    ...config,
    lastUpdated: new Date(),
  };
  await setDoc(docRef, updated, { merge: true });
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ ...defaultCourseBoxConfig, ...updated }));
}
