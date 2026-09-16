import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { auth, db } from "@/firebase/config";
import { deleteUser } from "firebase/auth";
import { doc, deleteDoc } from "firebase/firestore";

export default function SettingsScreen() {
  const { logout, profile } = useAuth();
  const { colors, isDark } = useTheme();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you absolutely sure you want to delete your account? This will permanently erase your profile, wallet balance, and purchased courses. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete My Account", 
          style: "destructive",
          onPress: async () => {
            if (!auth.currentUser) return;
            const uid = auth.currentUser.uid;
            setIsDeleting(true);
            try {
              // Delete Firestore Profile
              await deleteDoc(doc(db, "users", uid));
              
              // Delete Firebase Auth User
              await deleteUser(auth.currentUser);
              
              Alert.alert("Account Deleted", "Your account has been permanently removed.");
              // Logout will naturally happen or we force route to login
            } catch (e: any) {
              console.error(e);
              if (e.code === 'auth/requires-recent-login') {
                Alert.alert("Recent Login Required", "For security reasons, please log out and log back in before deleting your account.");
              } else {
                Alert.alert("Error", "Failed to delete account. Please try again later.");
              }
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        
        {/* APP INFO */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="information-circle-outline" size={20} color="#60A5FA" />
              <Text style={[styles.rowTitle, { color: colors.text }]}>App Version</Text>
            </View>
            <Text style={[styles.rowValue, { color: colors.textDim }]}>v1.0.0 (Build 42)</Text>
          </View>
          <View style={styles.divider} />
          
          <Pressable 
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
            onPress={() => {
              const domain = process.env.EXPO_PUBLIC_WEBSITE_URL || "https://coursearena.app";
              Linking.openURL(`${domain}/privacy`);
            }}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#10B981" />
              <Text style={[styles.rowTitle, { color: colors.text }]}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
          </Pressable>
          
          <View style={styles.divider} />
          
          <Pressable 
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
            onPress={() => {
              const domain = process.env.EXPO_PUBLIC_WEBSITE_URL || "https://coursearena.app";
              Linking.openURL(`${domain}/terms`);
            }}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="document-text-outline" size={20} color="#F59E0B" />
              <Text style={[styles.rowTitle, { color: colors.text }]}>Terms of Service</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
          </Pressable>
        </View>

        {/* ACCOUNT ACTIONS */}
        <Text style={[styles.sectionLabel, { color: colors.textDim }]}>ACCOUNT</Text>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Pressable 
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]} 
            onPress={async () => {
              Alert.alert(
                "Log Out",
                "Are you sure you want to log out of CourseArena?",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Log Out", style: "destructive", onPress: logout }
                ]
              );
            }}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="log-out-outline" size={20} color="#F87171" />
              <Text style={[styles.rowTitle, { color: "#F87171" }]}>Log Out</Text>
            </View>
          </Pressable>
        </View>

        {/* DANGER ZONE */}
        <Text style={[styles.sectionLabel, { color: "#EF4444", marginTop: 24 }]}>DANGER ZONE</Text>
        <View style={[styles.section, { backgroundColor: "rgba(239,68,68,0.05)", borderColor: "rgba(239,68,68,0.2)" }]}>
          <Pressable 
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]} 
            onPress={handleDeleteAccount} 
            disabled={isDeleting}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text style={[styles.rowTitle, { color: "#EF4444", fontWeight: "700" }]}>Delete My Account</Text>
            </View>
            {isDeleting && <ActivityIndicator color="#EF4444" size="small" />}
          </Pressable>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: "700" },
  content: { padding: 20 },
  sectionLabel: { fontSize: 12, fontWeight: "700", marginLeft: 12, marginBottom: 8, letterSpacing: 1, marginTop: 12 },
  section: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowTitle: { fontSize: 15, fontWeight: "500" },
  rowValue: { fontSize: 14 },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.05)" },
});
