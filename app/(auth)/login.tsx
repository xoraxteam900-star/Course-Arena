import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Dimensions,
} from "react-native";
import { Link, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import SocialAuth from "@/components/SocialAuth";

const { width } = Dimensions.get("window");

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit() {
    if (!email || !password) return Alert.alert("Missing info", "Enter email and password.");
    setBusy(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert("Login failed", e.message ?? "Check your credentials and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Abstract Background Waves (Bottom) */}
      <View style={styles.waveLayer1} />
      <View style={styles.waveLayer2} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color="#1F2937" />
          </Pressable>
          
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="school" size={48} color="#1769E0" />
            <View style={styles.brandRow}>
              <Text style={styles.brandCourse}>Course </Text>
              <Text style={styles.brandArena}>Arena</Text>
            </View>
            <Text style={styles.tagline}>Learn · Grow · Succeed</Text>
          </View>

          <View style={styles.titleSection}>
            <Text style={styles.heading}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue your learning journey</Text>
          </View>

          <SocialAuth />

          {/* Inputs */}
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email or username"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#9CA3AF" />
            </Pressable>
          </View>

          <Pressable style={styles.forgotBtn}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>

          <Pressable style={styles.button} onPress={onSubmit} disabled={busy}>
            <Text style={styles.buttonText}>{busy ? "Signing in..." : "Sign In"}</Text>
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/register" asChild>
              <Pressable>
                <Text style={styles.footerLink}>Sign Up</Text>
              </Pressable>
            </Link>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollContent: { flexGrow: 1, padding: 24, paddingBottom: 60, paddingTop: 60 },
  backBtn: { position: "absolute", top: Platform.OS === "ios" ? 50 : 30, left: 20, zIndex: 10 },
  header: { alignItems: "center", marginTop: 40, marginBottom: 30 },
  brandRow: { flexDirection: "row", marginTop: 8 },
  brandCourse: { fontSize: 24, fontWeight: "800", color: "#000000" },
  brandArena: { fontSize: 24, fontWeight: "800", color: "#1769E0" },
  tagline: { fontSize: 13, color: "#6B7280", marginTop: 4 },
  titleSection: { alignItems: "center", marginBottom: 24 },
  heading: { fontSize: 24, fontWeight: "800", color: "#1F2937", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#6B7280" },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    marginBottom: 16,
    height: 54,
  },
  inputIcon: { paddingHorizontal: 16 },
  input: { flex: 1, fontSize: 15, color: "#1F2937", height: "100%" },
  eyeIcon: { paddingHorizontal: 16, height: "100%", justifyContent: "center" },
  forgotBtn: { alignSelf: "flex-end", marginBottom: 24 },
  forgotText: { color: "#1769E0", fontSize: 14, fontWeight: "600" },
  button: { backgroundColor: "#1769E0", borderRadius: 12, height: 54, alignItems: "center", justifyContent: "center", marginBottom: 30 },
  buttonText: { color: "#ffffff", fontWeight: "700", fontSize: 16 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: "auto" },
  footerText: { color: "#6B7280", fontSize: 14 },
  footerLink: { color: "#1769E0", fontSize: 14, fontWeight: "700" },
  // Subtle bottom waves
  waveLayer1: {
    position: "absolute",
    bottom: -100,
    left: -100,
    width: width * 1.5,
    height: width * 1.5,
    borderRadius: width,
    backgroundColor: "#F0F7FF",
    opacity: 0.8,
  },
  waveLayer2: {
    position: "absolute",
    bottom: -150,
    right: -100,
    width: width * 1.5,
    height: width * 1.5,
    borderRadius: width,
    backgroundColor: "#E0F0FF",
    opacity: 0.6,
  },
});
