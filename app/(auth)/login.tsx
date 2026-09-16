import { useState, useEffect } from "react";
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
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/contexts/AuthContext";
import { 
  sendPasswordResetOtp, 
  verifyOtpCode, 
  resetUserPassword 
} from "@/services/otpService";

const { width } = Dimensions.get("window");

export default function Login() {
  const { firebaseUser, login, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    if (firebaseUser) {
      router.replace("/(tabs)");
    }
  }, [firebaseUser]);

  // OTP Reset State: "none" | "verify_otp" | "set_password"
  const [resetMode, setResetMode] = useState<"none" | "verify_otp" | "set_password">("none");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 1: Request OTP code from PHP backend
  async function handleRequestOtp() {
    const trimmed = email.trim();
    if (!trimmed) return Alert.alert("Missing info", "Please enter your email first.");
    setBusy(true);
    try {
      await sendPasswordResetOtp(trimmed);
      setResetMode("verify_otp");
      Alert.alert("Code Sent", `A 6-digit code has been sent to ${trimmed}. Please check your email.`);
    } catch (e: any) {
      Alert.alert("Failed to Send Code", e.message ?? "Could not send verification code.");
    } finally {
      setBusy(false);
    }
  }

  // Step 2: Verify OTP code (Must verify before setting new password)
  async function handleVerifyOtpCode() {
    if (!otp || otp.length < 6) return Alert.alert("Missing info", "Please enter the complete 6-digit OTP code.");
    setBusy(true);
    try {
      await verifyOtpCode(email.trim(), otp.trim());
      // Successfully verified! Now advance to Step 3: Set New Password
      setResetMode("set_password");
      Alert.alert("Code Verified", "Please enter your new password below.");
    } catch (e: any) {
      Alert.alert("Verification Failed", e.message ?? "Incorrect or expired OTP code.");
    } finally {
      setBusy(false);
    }
  }

  // Step 3: Set new password only after OTP is verified
  async function handleSetNewPassword() {
    if (!newPassword || newPassword.length < 6) {
      return Alert.alert("Invalid Password", "Password must be at least 6 characters.");
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      return Alert.alert("Mismatch", "Passwords do not match. Please re-enter.");
    }
    setBusy(true);
    try {
      await resetUserPassword(email.trim(), newPassword);
      Alert.alert("Success", "Password updated successfully. You can now log in.");
      setResetMode("none");
      setPassword("");
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to update password.");
    } finally {
      setBusy(false);
    }
  }

  // Direct in-app trigger for Forgot Password
  async function onForgotPassword() {
    const trimmed = email.trim();
    if (!trimmed) {
      return Alert.alert(
        "Enter Email First",
        "Please enter your email address in the field above first, then tap Forgot password."
      );
    }
    await handleRequestOtp();
  }

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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <Pressable onPress={() => {
            if (resetMode !== "none") setResetMode("none");
            else router.back();
          }} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color="#1F2937" />
          </Pressable>
          
          <View style={styles.header}>
            <Ionicons name="school" size={48} color="#1769E0" />
            <View style={styles.brandRow}>
              <Text style={styles.brandCourse}>Course </Text>
              <Text style={styles.brandArena}>Arena</Text>
            </View>
          </View>

          {resetMode === "none" && (
            <>
              <View style={styles.titleSection}>
                <Text style={styles.heading}>Welcome Back</Text>
                <Text style={styles.subtitle}>Sign in to continue your learning journey</Text>
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

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <Pressable style={{ flexDirection: "row", alignItems: "center" }} onPress={() => setRememberMe(!rememberMe)}>
                  <Ionicons name={rememberMe ? "checkbox" : "square-outline"} size={20} color={rememberMe ? "#1769E0" : "#9CA3AF"} />
                  <Text style={{ marginLeft: 8, color: "#4B5563", fontSize: 14 }}>Remember me</Text>
                </Pressable>
                <Pressable onPress={onForgotPassword}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </Pressable>
              </View>

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
            </>
          )}

          {resetMode === "verify_otp" && (
            <>
              <View style={styles.titleSection}>
                <Text style={styles.heading}>Verify Code</Text>
                <Text style={styles.subtitle}>Enter the 6-digit code we sent to {email}</Text>
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="key-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="6-digit code"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={setOtp}
                />
              </View>

              <Pressable style={styles.button} onPress={handleVerifyOtpCode} disabled={busy}>
                <Text style={styles.buttonText}>{busy ? "Verifying Code..." : "Verify Code"}</Text>
              </Pressable>

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: -10 }}>
                <Pressable onPress={() => setResetMode("none")}>
                  <Text style={{ color: "#6B7280", fontSize: 14, fontWeight: "600" }}>← Back to Login</Text>
                </Pressable>
                <Pressable onPress={handleRequestOtp}>
                  <Text style={{ color: "#1769E0", fontSize: 14, fontWeight: "600" }}>Resend Code</Text>
                </Pressable>
              </View>
            </>
          )}

          {resetMode === "set_password" && (
            <>
              <View style={styles.titleSection}>
                <Text style={styles.heading}>New Password</Text>
                <Text style={styles.subtitle}>Code verified! Set your new password below.</Text>
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="New Password (min. 6 characters)"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPassword}
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#9CA3AF" />
                </Pressable>
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm New Password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
              </View>

              <Pressable style={styles.button} onPress={handleSetNewPassword} disabled={busy}>
                <Text style={styles.buttonText}>{busy ? "Updating Password..." : "Set New Password"}</Text>
              </Pressable>

              <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: -10 }}>
                <Pressable onPress={() => setResetMode("none")}>
                  <Text style={{ color: "#6B7280", fontSize: 14, fontWeight: "600" }}>← Cancel</Text>
                </Pressable>
              </View>
            </>
          )}

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
  subtitle: { fontSize: 14, color: "#6B7280", textAlign: "center" },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
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
});
