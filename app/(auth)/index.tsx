import { useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Platform, Alert, Dimensions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import { useGoogleAuthRequest, signInWithGoogleIdToken, signInWithApple } from "@/services/socialAuth";
import { useAuth } from "@/contexts/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

export default function AuthLanding() {
  const { ensureProfile } = useAuth();
  const [request, response, promptAsync] = useGoogleAuthRequest();

  useEffect(() => {
    if (response?.type === "success" && response.authentication?.idToken) {
      handleGoogleToken(response.authentication.idToken);
    }
  }, [response]);

  async function handleGoogleToken(idToken: string) {
    try {
      const cred = await signInWithGoogleIdToken(idToken);
      await ensureProfile(cred.user.uid, {
        fullName: cred.user.displayName ?? "",
        username: (cred.user.email ?? "user").split("@")[0],
        email: cred.user.email ?? "",
      });
      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert("Google sign-in failed", e.message ?? "Please try again.");
    }
  }

  async function onApple() {
    try {
      const { result, appleCredential } = await signInWithApple();
      await ensureProfile(result.user.uid, {
        fullName: appleCredential.fullName?.givenName
          ? `${appleCredential.fullName.givenName} ${appleCredential.fullName.familyName ?? ""}`.trim()
          : result.user.displayName ?? "",
        username: (result.user.email ?? appleCredential.email ?? "user").split("@")[0],
        email: result.user.email ?? appleCredential.email ?? "",
      });
      router.replace("/(tabs)");
    } catch (e: any) {
      if (e.code === "ERR_REQUEST_CANCELED") return;
      Alert.alert("Apple sign-in failed", e.message ?? "Please try again.");
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Background Ambient Glows */}
      <View style={styles.glowTop} />
      <View style={styles.glowMiddle} />

      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }} />
        <Pressable style={styles.settingsBtn}>
          <Ionicons name="settings-outline" size={20} color="#60A5FA" />
        </Pressable>
      </View>

      <View style={styles.content}>
        {/* Branding Section */}
        <View style={styles.brandContainer}>
          <View style={styles.logoWrapper}>
            <Ionicons name="school" size={56} color="#3B82F6" />
          </View>
          <View style={styles.brandTextRow}>
            <Text style={styles.brandTextWhite}>Course </Text>
            <Text style={styles.brandTextBlue}>Arena</Text>
          </View>
          <Text style={styles.tagline}>Learn · Grow · Succeed</Text>
        </View>

        {/* Auth Buttons Card */}
        <View style={styles.authCard}>
          <Pressable style={[styles.btn, styles.googleBtn]} onPress={() => promptAsync()} disabled={!request}>
            <Ionicons name="logo-google" size={20} color="#EA4335" style={styles.btnIcon} />
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </Pressable>

          {Platform.OS === "ios" && (
            <Pressable style={[styles.btn, styles.appleBtn]} onPress={onApple}>
              <Ionicons name="logo-apple" size={22} color="#fff" style={styles.btnIcon} />
              <Text style={styles.appleBtnText}>Continue with Apple</Text>
            </Pressable>
          )}

          <Pressable style={[styles.btn, styles.emailBtn]} onPress={() => router.push("/(auth)/login")}>
            <Ionicons name="mail-outline" size={20} color="#E2E8F0" style={styles.btnIcon} />
            <Text style={styles.emailBtnText}>Continue with Email</Text>
          </Pressable>
        </View>
      </View>

      <Pressable style={styles.troubleBtn}>
        <Text style={styles.troubleText}>Having trouble signing in?</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#060A14" },
  glowTop: { position: "absolute", top: -100, left: width / 2 - 150, width: 300, height: 300, borderRadius: 150, backgroundColor: "#1746A2", opacity: 0.15, transform: [{ scale: 1.5 }] },
  glowMiddle: { position: "absolute", top: "40%", left: -100, width: 300, height: 300, borderRadius: 150, backgroundColor: "#3B82F6", opacity: 0.08, transform: [{ scale: 2 }] },
  topBar: { flexDirection: "row", paddingHorizontal: 24, paddingTop: 10, paddingBottom: 10, zIndex: 10 },
  settingsBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#0F172A", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#1E293B" },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: 24, paddingBottom: 40 },
  brandContainer: { alignItems: "center", marginBottom: 50 },
  logoWrapper: { marginBottom: 12, shadowColor: "#3B82F6", shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 0 }, elevation: 10 },
  brandTextRow: { flexDirection: "row", alignItems: "center" },
  brandTextWhite: { color: "#FFFFFF", fontSize: 28, fontWeight: "800" },
  brandTextBlue: { color: "#3B82F6", fontSize: 28, fontWeight: "800" },
  tagline: { color: "#9CA3AF", fontSize: 14, marginTop: 8, letterSpacing: 0.3 },
  authCard: { backgroundColor: "rgba(15, 23, 42, 0.4)", borderRadius: 24, padding: 24, borderWidth: 1, borderColor: "rgba(51, 65, 85, 0.5)" },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 16, height: 56, marginBottom: 12 },
  btnIcon: { position: "absolute", left: 20 },
  googleBtn: { backgroundColor: "#FFFFFF" },
  googleBtnText: { color: "#111827", fontWeight: "700", fontSize: 16 },
  appleBtn: { backgroundColor: "#000000", borderWidth: 1, borderColor: "#333333" },
  appleBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  emailBtn: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#334155" },
  emailBtnText: { color: "#E2E8F0", fontWeight: "700", fontSize: 16 },
  troubleBtn: { alignItems: "center", paddingBottom: 20 },
  troubleText: { color: "#64748B", fontSize: 13, fontWeight: "500" },
});
