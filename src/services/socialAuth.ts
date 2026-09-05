import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as AppleAuthentication from "expo-apple-authentication";
import { GoogleAuthProvider, OAuthProvider, signInWithCredential } from "@firebase/auth";
import { auth } from "@/firebase/config";

// --- Google ---
// Requires a dev build (EAS) - the native Google sign-in module isn't
// bundled in Expo Go. Client IDs come from Firebase Console ->
// Authentication -> Sign-in method -> Google -> Web SDK configuration
// (web client ID), and from the Google Cloud Console credentials page
// for the iOS/Android client IDs tied to your app's bundle id / package.
export function useGoogleAuthRequest() {
  return Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "dummy-web-client-id",
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "dummy-android-client-id",
  });
}

export async function signInWithGoogleIdToken(idToken: string) {
  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
}

// --- Apple ---
// iOS only, and also requires a dev build (native entitlement,
// "Sign In with Apple" capability). Won't run in Expo Go or on Android.
export async function signInWithApple() {
  const isAvailable = await AppleAuthentication.isAvailableAsync();
  if (!isAvailable) {
    throw new Error("Sign in with Apple isn't available on this device.");
  }
  const appleCredential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  const provider = new OAuthProvider("apple.com");
  const firebaseCredential = provider.credential({
    idToken: appleCredential.identityToken!,
  });
  const result = await signInWithCredential(auth, firebaseCredential);
  return { result, appleCredential };
}
