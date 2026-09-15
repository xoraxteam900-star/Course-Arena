import { Platform } from "react-native";

/**
 * Safe clipboard utility.
 * In Expo Go or custom dev builds where the native 'ExpoClipboard' module is not compiled,
 * direct top-level import of 'expo-clipboard' crashes the entire app at startup.
 *
 * This module dynamically attempts expo-clipboard on demand, falls back to web clipboard
 * or legacy react-native clipboard, and guarantees no unhandled exceptions.
 */

function getExpoClipboard(): any {
  try {
    return require("expo-clipboard");
  } catch {
    return null;
  }
}

/**
 * Sets a string to the system clipboard safely.
 * Returns true if successful, false otherwise.
 */
export async function setStringAsync(text: string): Promise<boolean> {
  // 1. Try expo-clipboard if native module is present in the binary
  try {
    const expoClipboard = getExpoClipboard();
    if (expoClipboard && typeof expoClipboard.setStringAsync === "function") {
      await expoClipboard.setStringAsync(text);
      return true;
    }
  } catch {
    // Native module not linked in current binary
  }

  // 2. Try browser clipboard API (Web platform)
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Navigator clipboard unavailable
  }

  // 3. Try legacy React Native Clipboard if available
  try {
    const RN = require("react-native");
    if (RN && RN.Clipboard && typeof RN.Clipboard.setString === "function") {
      RN.Clipboard.setString(text);
      return true;
    }
  } catch {
    // React Native core clipboard unavailable
  }

  return false;
}

/**
 * Gets a string from the system clipboard safely.
 */
export async function getStringAsync(): Promise<string> {
  // 1. Try expo-clipboard
  try {
    const expoClipboard = getExpoClipboard();
    if (expoClipboard && typeof expoClipboard.getStringAsync === "function") {
      return await expoClipboard.getStringAsync();
    }
  } catch {
    // Native module unavailable
  }

  // 2. Try browser clipboard API
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.readText === "function"
    ) {
      return await navigator.clipboard.readText();
    }
  } catch {
    // Navigator clipboard unavailable
  }

  return "";
}

/**
 * Shorthand helper for copying text
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  return await setStringAsync(text);
}

export default {
  setStringAsync,
  getStringAsync,
  copyToClipboard,
};
