import React, { useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Alert, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import * as AppleAuthentication from "expo-apple-authentication";
import { GoogleAuthProvider, OAuthProvider, signInWithCredential } from "@firebase/auth";
import { auth } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";

WebBrowser.maybeCompleteAuthSession();

export default function SocialAuth() {
  const { ensureProfile } = useAuth();

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "dummy-web-client-id",
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "dummy-android-client-id",
  });

  useEffect(() => {
    if (response?.type === "success") {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);

      signInWithCredential(auth, credential)
        .then(async (cred) => {
          await ensureProfile(cred.user.uid, {
            fullName: cred.user.displayName || "Google User",
            username: `user_${cred.user.uid.slice(0, 6)}`,
            email: cred.user.email || "",
          });
          router.replace("/(tabs)");
        })
        .catch((e: any) => {
          Alert.alert("Google Sign-In Failed", e.message ?? "Please try again.");
        });
    }
  }, [response]);

  async function loginWithApple() {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        const provider = new OAuthProvider("apple.com");
        const authCredential = provider.credential({
          idToken: credential.identityToken,
        });

        const cred = await signInWithCredential(auth, authCredential);

        // Apple only provides full name and email on the very first sign-in
        const fullName = credential.fullName
          ? `${credential.fullName.givenName || ""} ${credential.fullName.familyName || ""}`.trim()
          : cred.user.displayName || "Apple User";

        await ensureProfile(cred.user.uid, {
          fullName,
          username: `user_${cred.user.uid.slice(0, 6)}`,
          email: credential.email || cred.user.email || "",
        });

        router.replace("/(tabs)");
      }
    } catch (e: any) {
      if (e.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Apple Sign-In Failed", e.message ?? "Please try again.");
      }
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.buttonsCol}>
        <Pressable
          style={styles.googleBtn}
          onPress={() => promptAsync()}
          disabled={!request}
        >
          <Ionicons name="logo-google" size={20} color="#EA4335" style={styles.icon} />
          <Text style={styles.googleBtnText}>Continue with Google</Text>
        </Pressable>

        {Platform.OS === "ios" && (
          <Pressable style={styles.appleBtn} onPress={loginWithApple}>
            <Ionicons name="logo-apple" size={20} color="#fff" style={styles.icon} />
            <Text style={styles.appleBtnText}>Continue with Apple</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.line} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: 20,
  },
  buttonsCol: {
    gap: 12,
    marginBottom: 24,
  },
  googleBtn: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  googleBtnText: {
    color: "#1F2937",
    fontWeight: "600",
    fontSize: 15,
  },
  appleBtn: {
    flexDirection: "row",
    backgroundColor: "#000",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  appleBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  icon: {
    position: "absolute",
    left: 20,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#F3F4F6",
  },
  dividerText: {
    color: "#9CA3AF",
    paddingHorizontal: 12,
    fontSize: 13,
  },
});
