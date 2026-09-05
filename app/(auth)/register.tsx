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

export default function Register() {
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit() {
    if (!fullName || !email || !password) {
      return Alert.alert("Missing info", "Please fill in every field.");
    }
    const generatedUsername = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "") + Math.floor(Math.random() * 1000);
    if (password.length < 6) {
      return Alert.alert("Weak password", "Use at least 6 characters.");
    }
    setBusy(true);
    try {
      await register(fullName.trim(), generatedUsername, email.trim(), password);
      Alert.alert("Verify your email", "We sent a verification link to your inbox.");
      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert("Sign up failed", e.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.waveLayer1} />
      <View style={styles.waveLayer2} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color="#1F2937" />
          </Pressable>
          
          <View style={styles.header}>
            <Ionicons name="school" size={48} color="#1769E0" />
            <View style={styles.brandRow}>
              <Text style={styles.brandCourse}>Course </Text>
              <Text style={styles.brandArena}>Arena</Text>
            </View>
            <Text style={styles.tagline}>Learn · Grow · Succeed</Text>
          </View>

          <View style={styles.titleSection}>
            <Text style={styles.heading}>Create an Account</Text>
            <Text style={styles.subtitle}>Join thousands learning new skills</Text>
          </View>

          <SocialAuth />

          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor="#9CA3AF"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Username input omitted to strictly match the reference image which only shows Full name, Email, Password */}
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

          <Pressable style={styles.button} onPress={onSubmit} disabled={busy}>
            <Text style={styles.buttonText}>{busy ? "Creating account..." : "Sign Up"}</Text>
          </Pressable>

          <Text style={styles.legalText}>
            By creating an account, you agree to our{"\n"}
            <Text style={styles.legalLink}>Terms of Service</Text> and <Text style={styles.legalLink}>Privacy Policy</Text>.
          </Text>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text style={styles.footerLink}>Sign In</Text>
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
  button: { backgroundColor: "#1769E0", borderRadius: 12, height: 54, alignItems: "center", justifyContent: "center", marginTop: 8, marginBottom: 20 },
  buttonText: { color: "#ffffff", fontWeight: "700", fontSize: 16 },
  legalText: { color: "#9CA3AF", fontSize: 12, textAlign: "center", marginBottom: 30, lineHeight: 18 },
  legalLink: { color: "#1769E0", fontWeight: "600" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: "auto" },
  footerText: { color: "#6B7280", fontSize: 14 },
  footerLink: { color: "#1769E0", fontSize: 14, fontWeight: "700" },
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
