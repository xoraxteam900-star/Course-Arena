import { View, Text, StyleSheet, Pressable, Alert, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { FadeInView } from "@/components/FadeInView";

export default function Profile() {
  const { profile, logout } = useAuth();
  const { theme, setTheme, colors } = useTheme();

  const rows: { icon: any; label: string; onPress: () => void }[] = [
    { icon: "book-outline", label: "Submit a course (become an instructor)", onPress: () => router.push("/instructor") },
    { icon: "notifications-outline", label: "Notifications", onPress: () => router.push("/notifications") },
  ];

  if (profile?.role === "admin") {
    rows.push({ icon: "shield-checkmark-outline", label: "Admin panel", onPress: () => router.push("/admin") });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <FadeInView style={styles.container}>
      <View style={[styles.avatar, { backgroundColor: colors.card, overflow: "hidden", borderWidth: 3, borderColor: colors.primary }]}>
        <Image source={require("../../assets/images/logo.png")} style={{ width: "100%", height: "100%", resizeMode: "contain" }} />
      </View>
      <Text style={[styles.name, { color: colors.text }]}>{profile?.fullName}</Text>
      <Text style={[styles.username, { color: colors.textDim }]}>@{profile?.username}</Text>

      {/* Theme Selector */}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 24, width: "100%", paddingHorizontal: 4 }}>
        {(["light", "dark", "system"] as const).map((t) => (
          <Pressable 
            key={t}
            style={[
              styles.themeBtn, 
              { backgroundColor: colors.card, borderColor: theme === t ? colors.primary : colors.border }
            ]}
            onPress={() => setTheme(t)}
          >
            <Text style={{ color: theme === t ? colors.primary : colors.textDim, fontWeight: "700", textTransform: "capitalize" }}>{t}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ marginTop: 24, width: "100%" }}>
        {rows.map((r) => (
          <Pressable key={r.label} style={[styles.row, { backgroundColor: colors.card, shadowColor: colors.shadow }]} onPress={r.onPress}>
            <Ionicons name={r.icon} size={20} color={colors.textDim} />
            <Text style={[styles.rowLabel, { color: colors.text }]}>{r.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
          </Pressable>
        ))}

        <Pressable
          style={[styles.row, { backgroundColor: colors.card, shadowColor: colors.shadow }]}
          onPress={() =>
            Alert.alert("Log out", "Are you sure?", [
              { text: "Cancel", style: "cancel" },
              { text: "Log out", style: "destructive", onPress: logout },
            ])
          }
        >
          <Ionicons name="log-out-outline" size={20} color="#F87171" />
          <Text style={[styles.rowLabel, { color: "#F87171" }]}>Log out</Text>
        </Pressable>
      </View>
    </FadeInView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, alignItems: "center" },
  avatar: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center", marginTop: 24 },
  name: { fontSize: 20, fontWeight: "800", marginTop: 14 },
  username: { marginTop: 4, fontWeight: "600" },
  themeBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 12, borderWidth: 1.5 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 12, marginBottom: 10, width: "100%", shadowOpacity: 0.03, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  rowLabel: { flex: 1, fontWeight: "600" },
});
