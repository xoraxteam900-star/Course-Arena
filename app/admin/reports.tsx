import { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { collection, query, orderBy, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminReports() {
  const { profile } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "course_reports"), orderBy("createdAt", "desc")));
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (profile?.role === "admin") load();
  }, [profile]);

  async function resolveReport(id: string) {
    try {
      await updateDoc(doc(db, "course_reports", id), { status: "resolved" });
      load();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  }

  if (profile?.role !== "admin") return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0F172A" }}>
      <View style={styles.container}>
        <Pressable onPress={() => router.back()} style={{ marginBottom: 16, marginTop: 8 }}>
          <Text style={{ color: "#94A3B8", fontSize: 16 }}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>User Reports</Text>
        
        <FlatList
          data={reports}
          keyExtractor={r => r.id}
          onRefresh={load}
          refreshing={loading}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Course: {item.courseId}</Text>
                <Text style={[styles.status, item.status === "resolved" && styles.statusResolved]}>{item.status}</Text>
              </View>
              <Text style={styles.reason}>{item.reason}</Text>
              {item.status !== "resolved" && (
                <Pressable style={styles.resolveBtn} onPress={() => resolveReport(item.id)}>
                  <Text style={styles.resolveBtnText}>Mark Resolved</Text>
                </Pressable>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No reports found.</Text>}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 20 },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  cardTitle: { color: "#fff", fontWeight: "600", fontSize: 14, flex: 1 },
  status: { color: "#F87171", fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  statusResolved: { color: "#22C55E" },
  reason: { color: "#CBD5E1", lineHeight: 20, marginBottom: 12 },
  resolveBtn: { backgroundColor: "#6366F1", padding: 10, borderRadius: 8, alignItems: "center" },
  resolveBtnText: { color: "#fff", fontWeight: "600" },
  empty: { color: "#64748B", textAlign: "center", marginTop: 40 },
});
