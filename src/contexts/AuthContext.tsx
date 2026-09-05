import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  User,
} from "@firebase/auth";
import { doc, onSnapshot, setDoc, getDoc, serverTimestamp, collection, query, where, orderBy, limit } from "firebase/firestore";
import { auth, db } from "@/firebase/config";
import { UserProfile } from "@/types";
import { Animated, View, Text, StyleSheet, Pressable } from "react-native";

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  register: (fullName: string, username: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  ensureProfile: (uid: string, info: { fullName: string; username: string; email: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Custom in-app notification state
  const [banner, setBanner] = useState<{title: string, message: string} | null>(null);
  const bannerAnim = React.useRef(new Animated.Value(-150)).current;

  const showBanner = (title: string, message: string) => {
    setBanner({ title, message });
    Animated.spring(bannerAnim, { toValue: 50, useNativeDriver: true, speed: 12 }).start();
    setTimeout(() => {
      Animated.timing(bannerAnim, { toValue: -150, duration: 300, useNativeDriver: true }).start(() => setBanner(null));
    }, 4000);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    const ref = doc(db, "users", firebaseUser.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setProfile({ uid: snap.id, ...(snap.data() as any) });
      }
      setLoading(false);
    });
    return unsub;
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;
    let initialLoad = true;
    const q = query(collection(db, "notifications"), where("targetUserId", "==", null), orderBy("createdAt", "desc"), limit(1));
    const unsub = onSnapshot(q, (snap) => {
      if (initialLoad) {
        initialLoad = false;
        return;
      }
      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          showBanner(data.title || "New Notification", data.message || "You have a new message.");
        }
      });
    });
    return unsub;
  }, [firebaseUser]);

  async function register(fullName: string, username: string, email: string, password: string) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await createProfileIfMissing(cred.user.uid, { fullName, username, email: email ?? "" });
    await sendEmailVerification(cred.user);
  }

  // Google/Apple sign-in skip the register() form entirely, so the first
  // time a given uid shows up we backfill a users/{uid} profile from
  // whatever the provider gave us. Signup bonus is still credited
  // server-side by the onUserCreate Cloud Function either way — never
  // trust a client-set balance.
  async function createProfileIfMissing(
    uid: string,
    info: { fullName: string; username: string; email: string }
  ) {
    const ref = doc(db, "users", uid);
    const existing = await getDoc(ref);
    if (existing.exists()) return;
    await setDoc(ref, {
      fullName: info.fullName || "New user",
      username: info.username || `user_${uid.slice(0, 6)}`,
      email: info.email,
      role: "user",
      balance: 0,
      signupBonusGiven: false,
      emailVerified: false,
      onboardingCompleted: false,
      status: "active",
      createdAt: serverTimestamp(),
    });
  }

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    await firebaseSignOut(auth);
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email);
  }

  return (
    <AuthContext.Provider
      value={{ firebaseUser, profile, loading, register, login, logout, resetPassword, ensureProfile: createProfileIfMissing }}
    >
      {children}
      {banner && (
        <Animated.View style={[styles.banner, { transform: [{ translateY: bannerAnim }] }]}>
          <View style={styles.bannerIcon}>
            <Text style={{color:"#fff", fontWeight:"800"}}>!</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>{banner.title}</Text>
            <Text style={styles.bannerMessage} numberOfLines={2}>{banner.message}</Text>
          </View>
        </Animated.View>
      )}
    </AuthContext.Provider>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 20,
    right: 20,
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 10,
    zIndex: 9999,
  },
  bannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#6366F1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  bannerTitle: { color: "#fff", fontWeight: "800", fontSize: 15, marginBottom: 2 },
  bannerMessage: { color: "#94A3B8", fontSize: 13 },
});

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
