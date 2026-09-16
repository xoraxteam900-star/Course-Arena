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
import { useAuth } from "@/contexts/AuthContext";
import { sendRegistrationOtp, verifyOtpCode } from "@/services/otpService";
import { PolicyModal } from "@/components/PolicyModal";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "@/firebase/config";

const { width } = Dimensions.get("window");

export default function Register() {
  const { firebaseUser, register } = useAuth();

  useEffect(() => {
    if (firebaseUser) {
      router.replace("/(tabs)");
    }
  }, [firebaseUser]);

  const [step, setStep] = useState<"form" | "verify_otp">("form");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);

  // Countdown timer for OTP resend
  useEffect(() => {
    let timer: any;
    if (step === "verify_otp" && resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, resendCountdown]);

  // Step 1: Validate inputs and request email verification OTP
  async function handleRequestOtp() {
    const trimmedName = fullName.trim();
    const trimmedUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName || !trimmedUsername || !trimmedEmail || !password) {
      return Alert.alert("Missing info", "Please fill in every field.");
    }
    if (trimmedName.length < 2) {
      return Alert.alert("Invalid name", "Please enter your full name.");
    }
    if (trimmedUsername.length < 3) {
      return Alert.alert("Invalid username", "Username must be at least 3 characters.");
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return Alert.alert("Invalid email", "Please enter a valid email address.");
    }
    if (password.length < 6) {
      return Alert.alert("Weak password", "Password must be at least 6 characters.");
    }
    if (!policyAccepted) {
      return Alert.alert(
        "Policy Agreement Required",
        "Before creating an account, you must read and accept the Course Arena Educational Policy & Terms of Service.\n\nCourse Arena is an independent 1-person project for educational lab use only with zero tolerance for misuse.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Read Policy", onPress: () => setShowPolicyModal(true) },
        ]
      );
    }

    setBusy(true);
    try {
      // Check if username is already taken
      const q = query(collection(db, "users"), where("username", "==", trimmedUsername), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setBusy(false);
        return Alert.alert("Username Taken", "This username is already taken. Please choose another one.");
      }

      await sendRegistrationOtp(trimmedEmail);
      setStep("verify_otp");
      setResendCountdown(30);
      setOtp("");
      Alert.alert(
        "Verification Code Sent",
        `We have sent a 6-digit code to ${trimmedEmail}. Please check your inbox.`
      );
    } catch (e: any) {
      const msg = e.message || "";
      if (msg.includes("already registered") || msg.includes("already in use")) {
        Alert.alert(
          "Account Exists",
          "An account with this email already exists. Please sign in instead.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Sign In", onPress: () => router.push("/(auth)/login") },
          ]
        );
      } else {
        Alert.alert("Unable to Send Code", msg || "Could not send verification code. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  // Step 2: Verify the 6-digit OTP code and create the Firebase account
  async function handleVerifyAndRegister() {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedOtp = otp.trim();

    if (!trimmedOtp || trimmedOtp.length < 6) {
      return Alert.alert("Incomplete code", "Please enter the full 6-digit verification code.");
    }

    setBusy(true);
    try {
      // 1. Verify OTP with backend
      await verifyOtpCode(trimmedEmail, trimmedOtp);

      // 2. Verified real email! Proceed with Firebase user and profile creation
      const trimmedUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");

      await register(fullName.trim(), trimmedUsername, trimmedEmail, password);

      Alert.alert(
        "Email Verified",
        `Welcome to Course Arena, ${fullName.trim()}!`
      );
      router.replace("/(tabs)");
    } catch (e: any) {
      if (e.code === "auth/email-already-in-use") {
        Alert.alert("Account Exists", "This email is already registered. Please sign in instead.");
      } else {
        Alert.alert("Verification Failed", e.message ?? "Incorrect or expired code. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  // Resend OTP code
  async function handleResendOtp() {
    if (resendCountdown > 0 || busy) return;
    const trimmedEmail = email.trim().toLowerCase();
    setBusy(true);
    try {
      await sendRegistrationOtp(trimmedEmail);
      setResendCountdown(30);
      Alert.alert("Code Resent", `A new 6-digit code has been sent to ${trimmedEmail}.`);
    } catch (e: any) {
      Alert.alert("Resend Failed", e.message ?? "Could not resend code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <Pressable
            onPress={() => {
              if (step === "verify_otp") {
                setStep("form");
              } else {
                router.back();
              }
            }}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={28} color="#1F2937" />
          </Pressable>
          
          <View style={styles.header}>
            <Ionicons name="school" size={48} color="#1769E0" />
            <View style={styles.brandRow}>
              <Text style={styles.brandCourse}>Course </Text>
              <Text style={styles.brandArena}>Arena</Text>
            </View>
          </View>

          {step === "form" ? (
            <>
              <View style={styles.titleSection}>
                <Text style={styles.heading}>Create an Account</Text>
                <Text style={styles.subtitle}>Join thousands learning new skills</Text>
              </View>

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
                <Ionicons name="at-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  value={username}
                  onChangeText={setUsername}
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

              {/* Educational Policy Agreement Card */}
              <View style={styles.policyCard}>
                <Pressable
                  style={styles.policyCheckboxRow}
                  onPress={() => {
                    if (!policyAccepted) {
                      setShowPolicyModal(true);
                    } else {
                      setPolicyAccepted(false);
                    }
                  }}
                >
                  <Ionicons
                    name={policyAccepted ? "checkbox" : "square-outline"}
                    size={22}
                    color={policyAccepted ? "#1769E0" : "#9CA3AF"}
                  />
                  <Text style={styles.policyAgreementText}>
                    I have read and agree to the{" "}
                    <Text
                      style={styles.policyHighlight}
                      onPress={() => setShowPolicyModal(true)}
                    >
                      Educational Policy & Terms
                    </Text>
                  </Text>
                </Pressable>

                <View style={styles.policyNoticeBadge}>
                  <Ionicons name="information-circle" size={14} color="#1769E0" />
                  <Text style={styles.policyNoticeText}>
                    1-man project • Strictly educational lab use • Zero misuse tolerance
                  </Text>
                </View>

                <Pressable
                  style={styles.readPolicyBtn}
                  onPress={() => setShowPolicyModal(true)}
                >
                  <Ionicons name="document-text-outline" size={15} color="#1769E0" />
                  <Text style={styles.readPolicyBtnText}>
                    {policyAccepted ? "Review Policy Terms" : "Read Policy & Terms (Required)"}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color="#1769E0" />
                </Pressable>
              </View>

              <Pressable
                style={[styles.button, (!policyAccepted || busy) && styles.buttonDisabled]}
                onPress={handleRequestOtp}
                disabled={busy}
              >
                <Text style={styles.buttonText}>
                  {busy ? "Sending verification code..." : "Sign Up"}
                </Text>
              </Pressable>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <Link href="/(auth)/login" asChild>
                  <Pressable>
                    <Text style={styles.footerLink}>Sign In</Text>
                  </Pressable>
                </Link>
              </View>
            </>
          ) : (
            <>
              <View style={styles.titleSection}>
                <Text style={styles.heading}>Verify Your Email</Text>
                <Text style={styles.subtitle}>Enter the 6-digit code sent to confirm your email</Text>
              </View>

              <Pressable onPress={() => setStep("form")} style={styles.emailBadge}>
                <Ionicons name="mail" size={16} color="#1E40AF" />
                <Text style={styles.emailBadgeText} numberOfLines={1}>
                  {email}
                </Text>
                <Ionicons name="pencil" size={14} color="#1E40AF" style={{ marginLeft: 4 }} />
              </Pressable>

              <View style={styles.inputContainer}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#1769E0" style={styles.inputIcon} />
                <TextInput
                  style={styles.otpInput}
                  placeholder="000000"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={(val) => setOtp(val.replace(/[^0-9]/g, ""))}
                  autoFocus={true}
                />
              </View>

              <Pressable
                style={[styles.button, otp.length < 6 && styles.buttonDisabled]}
                onPress={handleVerifyAndRegister}
                disabled={busy || otp.length < 6}
              >
                <Text style={styles.buttonText}>
                  {busy ? "Verifying & Creating..." : "Verify & Create Account"}
                </Text>
              </Pressable>

              <View style={styles.resendRow}>
                <Pressable onPress={() => setStep("form")}>
                  <Text style={styles.changeEmailLink}>← Change Email</Text>
                </Pressable>
                <Pressable onPress={handleResendOtp} disabled={resendCountdown > 0 || busy}>
                  <Text style={resendCountdown > 0 ? styles.resendDisabled : styles.resendLink}>
                    {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend Code"}
                  </Text>
                </Pressable>
              </View>

              <View style={[styles.footer, { marginTop: 40 }]}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <Link href="/(auth)/login" asChild>
                  <Pressable>
                    <Text style={styles.footerLink}>Sign In</Text>
                  </Pressable>
                </Link>
              </View>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      <PolicyModal
        visible={showPolicyModal}
        onClose={() => setShowPolicyModal(false)}
        onAccept={() => setPolicyAccepted(true)}
        showAcceptButton={true}
      />
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
  titleSection: { alignItems: "center", marginBottom: 24 },
  heading: { fontSize: 24, fontWeight: "800", color: "#1F2937", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#6B7280", textAlign: "center" },
  emailBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: "center",
    marginBottom: 20,
    gap: 6,
  },
  emailBadgeText: {
    color: "#1E40AF",
    fontWeight: "600",
    fontSize: 14,
    maxWidth: width * 0.65,
  },
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
  otpInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 8,
    color: "#1F2937",
    height: "100%",
    textAlign: "center",
  },
  eyeIcon: { paddingHorizontal: 16, height: "100%", justifyContent: "center" },
  button: {
    backgroundColor: "#1769E0",
    borderRadius: 12,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: { color: "#ffffff", fontWeight: "700", fontSize: 16 },
  resendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    paddingHorizontal: 4,
  },
  changeEmailLink: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "600",
  },
  resendLink: {
    color: "#1769E0",
    fontSize: 14,
    fontWeight: "600",
  },
  resendDisabled: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "500",
  },
  legalText: { color: "#9CA3AF", fontSize: 12, textAlign: "center", marginBottom: 30, lineHeight: 18 },
  legalLink: { color: "#1769E0", fontWeight: "600" },
  policyCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    marginBottom: 16,
    gap: 10,
  },
  policyCheckboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  policyAgreementText: {
    flex: 1,
    fontSize: 13,
    color: "#334155",
    lineHeight: 19,
    fontWeight: "500",
  },
  policyHighlight: {
    color: "#1769E0",
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  policyNoticeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 6,
    marginLeft: 32,
  },
  policyNoticeText: {
    fontSize: 11,
    color: "#1E40AF",
    fontWeight: "600",
  },
  readPolicyBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#F1F5F9",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
    marginLeft: 32,
  },
  readPolicyBtnText: {
    color: "#1769E0",
    fontSize: 12,
    fontWeight: "700",
  },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: "auto" },
  footerText: { color: "#6B7280", fontSize: 14 },
  footerLink: { color: "#1769E0", fontSize: 14, fontWeight: "700" },
});

