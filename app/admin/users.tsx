import { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, FlatList, StyleSheet, Pressable, TextInput, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { collection, getDocs, doc, updateDoc, orderBy, query, limit } from "firebase/firestore";
import { db } from "@/firebase/config";
import { UserProfile, UserRole } from "@/types";

const ROLE_COLORS: Record<UserRole, string> = {
  admin: "#EC4899",
  instructor: "#0EA5E9",
  user: "#64748B",
};

export default function AdminUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc"), limit(200)));
      setUsers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as any) })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.fullName?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
    );
  }, [users, search]);

  async function setRole(uid: string, role: UserRole) {
    setBusyUid(uid);
    try {
      await updateDoc(doc(db, "users", uid), { role });
      setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, role } : u)));
    } catch (e: any) {
      Alert.alert("Failed", e.message ?? "Try again");
    } finally {
      setBusyUid(null);
    }
  }

  async function toggleStatus(uid: string, current: "active" | "suspended") {
    const next = current === "active" ? "suspended" : "active";
    setBusyUid(uid);
    try {
      await updateDoc(doc(db, "users", uid), { status: next });
      setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, status: next } : u)));
    } catch (e: any) {
      Alert.alert("Failed", e.message ?? "Try again");
    } finally {
      setBusyUid(null);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1120" }}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/admin"))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={18} color="#94A3B8" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.count}>{filtered.length} users</Text>
      </View>

      <Text style={styles.title}>Users</Text>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color="#64748B" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name, username, or email"
          placeholderTextColor="#64748B"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      </View>

      {loading ? (
        <ActivityIndicator color="#6366F1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(u) => u.uid}
          contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 60 }}
          ListEmptyComponent={<Text style={styles.empty}>No users found.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.fullName || "Unnamed"}</Text>
                  <Text style={styles.email}>{item.email}</Text>
                </View>
                <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[item.role] + "22" }]}>
                  <Text style={[styles.roleBadgeText, { color: ROLE_COLORS[item.role] }]}>{item.role}</Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaText}>GH₵{(item.balance ?? 0).toFixed(2)} balance</Text>
                <View style={[styles.statusDot, { backgroundColor: item.status === "active" ? "#22C55E" : "#F87171" }]} />
                <Text style={styles.metaText}>{item.status}</Text>
              </View>

              <View style={styles.actionsRow}>
                {(["user", "instructor", "admin"] as UserRole[]).map((r) => (
                  <Pressable
                    key={r}
                    disabled={busyUid === item.uid || item.role === r}
                    style={[styles.roleChip, item.role === r && { backgroundColor: "#6366F1" }]}
                    onPress={() => setRole(item.uid, r)}
                  >
                    <Text style={[styles.roleChipText, item.role === r && { color: "#fff" }]}>{r}</Text>
                  </Pressable>
                ))}
                <Pressable
                  disabled={busyUid === item.uid}
                  style={[styles.statusBtn, item.status === "active" ? styles.suspendBtn : styles.reactivateBtn]}
                  onPress={() => toggleStatus(item.uid, item.status)}
                >
                  <Text style={styles.statusBtnText}>{item.status === "active" ? "Suspend" : "Reactivate"}</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 8 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { color: "#94A3B8", fontSize: 15 },
  count: { color: "#64748B", fontSize: 12 },
  title: { color: "#fff", fontSize: 24, fontWeight: "800", paddingHorizontal: 20, marginTop: 8 },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#131C31", marginHorizontal: 20, marginTop: 14,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "#1E293B",
  },
  searchInput: { flex: 1, color: "#fff" },
  card: { backgroundColor: "#131C31", borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#1E293B" },
  name: { color: "#fff", fontWeight: "700", fontSize: 15 },
  email: { color: "#64748B", fontSize: 12, marginTop: 2 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  roleBadgeText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  metaText: { color: "#94A3B8", fontSize: 12 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 6 },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  roleChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: "#1E293B" },
  roleChipText: { color: "#94A3B8", fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  statusBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginLeft: "auto" },
  suspendBtn: { backgroundColor: "#7F1D1D" },
  reactivateBtn: { backgroundColor: "#14532D" },
  statusBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  empty: { color: "#64748B", textAlign: "center", marginTop: 40 },
});
