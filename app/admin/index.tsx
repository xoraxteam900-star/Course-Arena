import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { collection, query, where, getDocs } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db, app } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { Course } from "@/types";

const functions = getFunctions(app);

export default function AdminHome() {
  const { profile } = useAuth();
  const [pending, setPending] = useState<Course[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const snap = await getDocs(query(collection(db, "courses"), where("reviewStatus", "==", "pending_review")));
    setPending(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
  }, []);

  useEffect(() => {
    if (profile?.role === "admin") load();
  }, [profile, load]);

  if (profile?.role !== "admin") {
    return (
      <View style={styles.container}>
        <Text style={styles.deniedText}>Admin access only.</Text>
      </View>
    );
  }

  async function approve(courseId: string) {
    setBusyId(courseId);
    try {
      await httpsCallable(functions, "approveCourse")({ courseId });
      load();
    } catch (e: any) {
      Alert.alert("Failed", e.message ?? "Try again");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(courseId: string) {
    setBusyId(courseId);
    try {
      await httpsCallable(functions, "rejectCourse")({ courseId, reason: "Does not meet quality guidelines." });
      load();
    } catch (e: any) {
      Alert.alert("Failed", e.message ?? "Try again");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0F172A" }}>
    <View style={styles.container}>
      <Pressable onPress={() => {
        if (router.canGoBack()) router.back();
        else router.replace("/(tabs)");
      }} style={{ marginBottom: 16, marginTop: 8 }}>
        <Text style={{ color: "#94A3B8", fontSize: 16 }}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Admin Dashboard</Text>
      
      <View style={styles.grid}>
        <Pressable style={styles.gridBtn} onPress={() => router.push("/admin/categories")}>
          <Ionicons name="folder-outline" size={28} color="#6366F1" />
          <Text style={styles.gridBtnText}>Categories</Text>
        </Pressable>
        <Pressable style={styles.gridBtn} onPress={() => router.push("/admin/courses")}>
          <Ionicons name="library-outline" size={28} color="#6366F1" />
          <Text style={styles.gridBtnText}>All Courses</Text>
        </Pressable>
        <Pressable style={styles.gridBtn} onPress={() => router.push("/admin/reports")}>
          <Ionicons name="warning-outline" size={28} color="#F59E0B" />
          <Text style={styles.gridBtnText}>Reports</Text>
        </Pressable>
        <Pressable style={styles.gridBtn} onPress={() => router.push("/admin/notifications")}>
          <Ionicons name="notifications-outline" size={28} color="#22C55E" />
          <Text style={styles.gridBtnText}>Notify Users</Text>
        </Pressable>
        <Pressable style={styles.gridBtn} onPress={() => router.push("/admin/promos")}>
          <Ionicons name="gift-outline" size={28} color="#EC4899" />
          <Text style={styles.gridBtnText}>Promos</Text>
        </Pressable>
        <Pressable style={[styles.gridBtn, { backgroundColor: "#6366F1" }]} onPress={() => router.push("/admin/new-course")}>
          <Ionicons name="add-circle" size={28} color="#fff" />
          <Text style={[styles.gridBtnText, { color: "#fff" }]}>New Course</Text>
        </Pressable>
      </View>
      
      <Text style={[styles.title, { marginTop: 10 }]}>Pending review ({pending.length})</Text>
      <FlatList
        data={pending}
        keyExtractor={(c) => c.id}
        onRefresh={load}
        refreshing={false}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardMeta}>GH₵{item.price.toFixed(2)}</Text>
            <View style={styles.rowBtns}>
              <Pressable style={[styles.btn, styles.approveBtn]} onPress={() => approve(item.id)} disabled={busyId === item.id}>
                <Text style={styles.btnText}>Approve</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.rejectBtn]} onPress={() => reject(item.id)} disabled={busyId === item.id}>
                <Text style={styles.btnText}>Reject</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Nothing waiting on review.</Text>}
      />
    </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { color: "#fff", fontSize: 24, fontWeight: "800", marginBottom: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  gridBtn: { width: "48%", backgroundColor: "#1E293B", borderRadius: 16, padding: 16, alignItems: "center", justifyContent: "center", minHeight: 110, borderWidth: 1, borderColor: "#334155" },
  gridBtnText: { color: "#E2E8F0", fontWeight: "700", marginTop: 10, fontSize: 14 },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginBottom: 10 },
  cardTitle: { color: "#fff", fontWeight: "600" },
  cardMeta: { color: "#94A3B8", marginTop: 4 },
  rowBtns: { flexDirection: "row", gap: 10, marginTop: 12 },
  btn: { flex: 1, padding: 10, borderRadius: 10, alignItems: "center" },
  approveBtn: { backgroundColor: "#22C55E" },
  rejectBtn: { backgroundColor: "#F87171" },
  btnText: { color: "#0F172A", fontWeight: "700" },
  empty: { color: "#64748B", textAlign: "center", marginTop: 40 },
  deniedText: { color: "#64748B", textAlign: "center", marginTop: 60 },
});
