import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Image,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { FadeInView } from "@/components/FadeInView";
import {
  listenToPlatformFeatures,
  PlatformFeatures,
} from "@/services/platformFeatures";
import { PolicyModal } from "@/components/PolicyModal";
import { listNotificationsFor } from "@/services/notifications";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase/config";

export default function Profile() {
  const { profile, logout } = useAuth();
  const { theme, setTheme, colors, isDark } = useTheme();
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [features, setFeatures] = useState<PlatformFeatures>({
    enableGifting: true,
    enableChat: true,
  });

  // Edit profile state
  const [showEditModal, setShowEditModal] = useState(false);
  const [newName, setNewName] = useState(profile?.fullName || "");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    const unsub = listenToPlatformFeatures(setFeatures);
    return () => unsub();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!profile?.uid) return;
      listNotificationsFor(profile.uid)
        .then((notifs) => {
          const unread = notifs.filter((n) => !n.read).length;
          setUnreadNotifCount(unread);
        })
        .catch(() => {
          setUnreadNotifCount(0);
        });
    }, [profile?.uid])
  );

  const firstName = profile?.fullName ? profile.fullName.split(" ")[0] : "Kwasi";
  const roleTitle =
    profile?.role === "admin"
      ? "Admin"
      : profile?.role === "instructor"
      ? "Instructor"
      : "Student";

  async function handleSaveName() {
    if (!profile?.uid || !newName.trim()) return;
    setSavingName(true);
    try {
      await updateDoc(doc(db, "users", profile.uid), {
        fullName: newName.trim(),
      });
      setShowEditModal(false);
      Alert.alert("Success", "Profile name updated!");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update profile.");
    } finally {
      setSavingName(false);
    }
  }

  const bg = isDark ? "#070B14" : colors.background;
  const cardBg = isDark ? "#101625" : colors.card;
  const borderCol = isDark ? "rgba(255,255,255,0.06)" : "#E2E8F0";
  const textColor = isDark ? "#FFFFFF" : "#0F172A";
  const textDimColor = isDark ? "#94A3B8" : "#64748B";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <FadeInView style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* HEADER ROW */}
          <View style={styles.headerRow}>
            <View style={styles.greetingContainer}>
              <Text style={[styles.greetingText, { color: textDimColor }]}>Hello,</Text>
              <Text style={[styles.nameHeader, { color: textColor }]}>{firstName} 👋</Text>
              <Text style={[styles.greetingSub, { color: textDimColor }]}>Manage your account and settings</Text>
            </View>

            {/* ARTISTIC TAGLINE */}
            <View style={styles.taglineContainer}>
              <Text style={[styles.taglineText, { color: isDark ? "#A5B4FC" : "#4338CA" }]}>Good</Text>
              <Text style={[styles.taglineText, { color: isDark ? "#A5B4FC" : "#4338CA" }]}>Learning</Text>
              <Text style={[styles.taglineText, { color: isDark ? "#A5B4FC" : "#4338CA" }]}>Always</Text>
              <View style={[styles.taglineUnderline, { backgroundColor: isDark ? "#818CF8" : "#6366F1" }]} />
            </View>
          </View>

          {/* AVATAR & USER IDENTITY */}
          <View style={styles.avatarSection}>
            {/* GLOWING AVATAR CONTAINER */}
            <View style={[styles.avatarGlowRing, { borderColor: isDark ? "#6366F1" : "#818CF8" }]}>
              <View style={[styles.avatarInnerRing, { backgroundColor: isDark ? "#0B0F19" : "#EEF2F6" }]}>
                <Image
                  source={require("../../assets/images/logo.png")}
                  style={styles.avatarImage}
                  resizeMode="contain"
                />
              </View>

              {/* EDIT PENCIL BUTTON */}
              <Pressable
                style={styles.editBadge}
                hitSlop={8}
                onPress={() => {
                  setNewName(profile?.fullName || "");
                  setShowEditModal(true);
                }}
              >
                <Ionicons name="pencil" size={14} color="#FFFFFF" />
              </Pressable>
            </View>

            {/* DISPLAY NAME & USERNAME */}
            <Text style={[styles.displayName, { color: textColor }]}>{profile?.fullName || firstName}</Text>
            <Text style={[styles.username, { color: textDimColor }]}>@{profile?.username || "xoraxc"}</Text>

            {/* ROLE PILL */}
            <View style={styles.roleBadge}>
              <Ionicons name="school" size={14} color="#818CF8" />
              <Text style={styles.roleText}>{roleTitle}</Text>
            </View>
          </View>

          {/* THEME SELECTOR PILL ROW */}
          <View style={[styles.themeRowContainer, { backgroundColor: isDark ? "#101625" : "#F1F5F9", borderColor: borderCol }]}>
            {(
              [
                { key: "light", label: "Light", icon: "sunny-outline" },
                { key: "dark", label: "Dark", icon: "moon" },
                { key: "system", label: "System", icon: "desktop-outline" },
              ] as const
            ).map((t) => {
              const active = theme === t.key;
              return (
                <Pressable
                  key={t.key}
                  style={[
                    styles.themeBtn,
                    active && styles.themeBtnActive,
                  ]}
                  onPress={() => setTheme(t.key)}
                >
                  <Ionicons
                    name={t.icon as any}
                    size={16}
                    color={active ? "#FFFFFF" : textDimColor}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.themeBtnText,
                      active ? styles.themeBtnTextActive : [styles.themeBtnTextInactive, { color: textDimColor }],
                    ]}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* MENU ITEMS LIST */}
          <View style={styles.menuContainer}>
            {/* NOTIFICATIONS */}
            <Pressable
              style={[styles.menuItem, { backgroundColor: cardBg, borderColor: borderCol }]}
              onPress={() => router.push("/notifications")}
            >
              <View style={[styles.menuIconBox, { backgroundColor: "rgba(99, 102, 241, 0.15)" }]}>
                <Ionicons name="notifications-outline" size={22} color="#818CF8" />
              </View>
              <View style={styles.menuTextBox}>
                <Text style={[styles.menuTitle, { color: textColor }]}>Notifications</Text>
                <Text style={[styles.menuSub, { color: textDimColor }]}>Manage your alerts and updates</Text>
              </View>
              {unreadNotifCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadNotifCount}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={18} color="#64748B" />
            </Pressable>

            {/* EDUCATIONAL POLICY & DISCLAIMER */}
            <Pressable
              style={[styles.menuItem, { backgroundColor: cardBg, borderColor: borderCol }]}
              onPress={() => setShowPolicyModal(true)}
            >
              <View style={[styles.menuIconBox, { backgroundColor: "rgba(59, 130, 246, 0.15)" }]}>
                <Ionicons name="document-text-outline" size={22} color="#60A5FA" />
              </View>
              <View style={styles.menuTextBox}>
                <Text style={[styles.menuTitle, { color: textColor }]}>Educational Policy & Disclaimer</Text>
                <Text style={[styles.menuSub, { color: textDimColor }]}>Read our terms and guidelines</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#64748B" />
            </Pressable>

            {/* FRIENDS & SOCIAL CHAT */}
            {features.enableChat && (
              <Pressable
                style={[styles.menuItem, { backgroundColor: cardBg, borderColor: borderCol }]}
                onPress={() => router.push("/chat")}
              >
                <View style={[styles.menuIconBox, { backgroundColor: "rgba(168, 85, 247, 0.15)" }]}>
                  <Ionicons name="chatbubbles-outline" size={22} color="#C084FC" />
                </View>
                <View style={styles.menuTextBox}>
                  <Text style={[styles.menuTitle, { color: textColor }]}>Friends & Social Chat</Text>
                  <Text style={[styles.menuSub, { color: textDimColor }]}>Connect with fellow learners</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#64748B" />
              </Pressable>
            )}

            {/* ADMIN PANEL */}
            {profile?.role === "admin" && (
              <Pressable
                style={[styles.menuItem, { backgroundColor: cardBg, borderColor: borderCol }]}
                onPress={() => router.push("/admin/settings")}
              >
                <View style={[styles.menuIconBox, { backgroundColor: "rgba(239, 68, 68, 0.15)" }]}>
                  <Ionicons name="construct-outline" size={22} color="#EF4444" />
                </View>
                <View style={styles.menuTextBox}>
                  <Text style={[styles.menuTitle, { color: textColor }]}>Admin Tools</Text>
                  <Text style={[styles.menuSub, { color: textDimColor }]}>Platform settings & moderation</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#64748B" />
              </Pressable>
            )}


            {/* INSTRUCTOR PANEL */}
            {profile?.role === "instructor" && (
              <Pressable
                style={[styles.menuItem, { backgroundColor: cardBg, borderColor: borderCol }]}
                onPress={() => router.push("/instructor")}
              >
                <View style={[styles.menuIconBox, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
                  <Ionicons name="school-outline" size={22} color="#FBBF24" />
                </View>
                <View style={styles.menuTextBox}>
                  <Text style={[styles.menuTitle, { color: textColor }]}>Instructor panel</Text>
                  <Text style={[styles.menuSub, { color: textDimColor }]}>Manage your courses and students</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#64748B" />
              </Pressable>
            )}

            {/* LOG OUT */}
            <Pressable
              style={[styles.menuItem, { backgroundColor: cardBg, borderColor: borderCol }]}
              onPress={() =>
                Alert.alert("Log out", "Are you sure you want to log out?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Log out", style: "destructive", onPress: logout },
                ])
              }
            >
              <View style={[styles.menuIconBox, { backgroundColor: "rgba(239, 68, 68, 0.15)" }]}>
                <Ionicons name="log-out-outline" size={22} color="#F87171" />
              </View>
              <View style={styles.menuTextBox}>
                <Text style={[styles.menuTitle, { color: "#F87171" }]}>Log out</Text>
                <Text style={[styles.menuSub, { color: textDimColor }]}>Sign out from your account</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#64748B" />
            </Pressable>
          </View>

          {/* MOTIVATIONAL QUOTE CARD */}
          <View
            style={[
              styles.quoteCard,
              {
                backgroundColor: isDark ? "#0E1424" : "#FFFFFF",
                borderColor: isDark ? "rgba(99, 102, 241, 0.2)" : "#E2E8F0",
              },
            ]}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.quoteIcon}>“</Text>
              <Text style={[styles.quoteTitle, { color: textColor }]}>Keep learning, keep growing.</Text>
              <Text style={[styles.quoteSub, { color: textDimColor }]}>Better skills. A brighter you.</Text>
            </View>

            <View style={styles.quoteBookContainer}>
              <Ionicons name="book-outline" size={46} color="rgba(129, 140, 248, 0.25)" />
            </View>
          </View>
        </ScrollView>
      </FadeInView>

      {/* EDIT PROFILE NAME MODAL */}
      <Modal visible={showEditModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Edit Profile Name</Text>
            <Text style={[styles.modalSubtitle, { color: textDimColor }]}>Update your display name across CourseArena.</Text>

            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: isDark ? "#070B14" : "#F1F5F9",
                  borderColor: borderCol,
                  color: textColor,
                },
              ]}
              value={newName}
              onChangeText={setNewName}
              placeholder="Enter your full name"
              placeholderTextColor="#94A3B8"
              autoFocus
            />

            <View style={styles.modalBtnRow}>
              <Pressable
                style={[styles.modalBtnCancel, { borderColor: borderCol }]}
                onPress={() => setShowEditModal(false)}
                disabled={savingName}
              >
                <Text style={{ color: textColor, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalBtnConfirm}
                onPress={handleSaveName}
                disabled={savingName}
              >
                {savingName ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* POLICY & DISCLAIMER MODAL */}
      <PolicyModal
        visible={showPolicyModal}
        onClose={() => setShowPolicyModal(false)}
        showAcceptButton={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
  },

  // HEADER
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    width: "100%",
    marginTop: 6,
  },
  greetingContainer: {
    flex: 1,
  },
  greetingText: {
    fontSize: 14,
    color: "#94A3B8",
    fontWeight: "500",
  },
  nameHeader: {
    fontSize: 26,
    fontWeight: "800",
    marginTop: 2,
    letterSpacing: -0.3,
  },
  greetingSub: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 4,
    fontWeight: "400",
  },

  // TAGLINE (Right side script)
  taglineContainer: {
    alignItems: "flex-end",
    transform: [{ rotate: "-4deg" }],
    marginTop: 4,
    paddingRight: 4,
  },
  taglineText: {
    fontSize: 16,
    fontStyle: "italic",
    fontWeight: "700",
    color: "#A5B4FC",
    lineHeight: 18,
    fontFamily: Platform.OS === "ios" ? "Snell Roundhand" : "serif",
    letterSpacing: 0.5,
  },
  taglineUnderline: {
    width: 65,
    height: 3,
    backgroundColor: "#818CF8",
    borderRadius: 2,
    marginTop: 4,
    opacity: 0.8,
  },

  // AVATAR SECTION
  avatarSection: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 26,
  },
  avatarGlowRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2.5,
    borderColor: "#6366F1",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 8,
  },
  avatarInnerRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#0B0F19",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: "80%",
    height: "80%",
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#6366F1",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: "#070B14",
  },
  displayName: {
    fontSize: 20,
    fontWeight: "800",
    marginTop: 14,
    letterSpacing: -0.2,
  },
  username: {
    fontSize: 14,
    color: "#94A3B8",
    marginTop: 2,
    fontWeight: "500",
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(99, 102, 241, 0.16)",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.25)",
  },
  roleText: {
    color: "#A5B4FC",
    fontSize: 13,
    fontWeight: "600",
  },

  // THEME SELECTOR PILL ROW
  themeRowContainer: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    marginTop: 24,
    width: "100%",
  },
  themeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
  },
  themeBtnActive: {
    backgroundColor: "#5B4DF5",
  },
  themeBtnText: {
    fontSize: 13,
  },
  themeBtnTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  themeBtnTextInactive: {
    color: "#94A3B8",
    fontWeight: "500",
  },

  // MENU ITEMS
  menuContainer: {
    marginTop: 20,
    width: "100%",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  menuIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  menuTextBox: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  menuSub: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  notifBadge: {
    backgroundColor: "#EF4444",
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  notifBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },

  // MOTIVATIONAL QUOTE CARD
  quoteCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 20,
    position: "relative",
    overflow: "hidden",
  },
  quoteIcon: {
    fontSize: 26,
    fontWeight: "900",
    color: "#818CF8",
    lineHeight: 24,
    marginBottom: 2,
  },
  quoteTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  quoteSub: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 3,
  },
  quoteBookContainer: {
    opacity: 0.8,
  },

  // EDIT MODAL
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#94A3B8",
    marginBottom: 16,
  },
  modalInput: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 20,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 12,
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  modalBtnConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#5B4DF5",
    alignItems: "center",
  },
});
