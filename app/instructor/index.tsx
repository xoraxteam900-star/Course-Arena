import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { coursesByCreator } from "@/services/courses";
import { Course } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  draft: "#64748B",
  pending_review: "#FBBF24",
  approved: "#22C55E",
  rejected: "#F87171",
  suspended: "#F87171",
};

export default function InstructorHub() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);

  const load = useCallback(async () => {
    if (!profile) return;
    setCourses((await coursesByCreator(profile.uid)) as Course[]);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  if (profile?.role !== "admin") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0F172A", justifyContent: "center", alignItems: "center", padding: 24 }}>
        <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 8 }}>
          Submissions Closed
        </Text>
        <Text style={{ color: "#94A3B8", fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 24 }}>
          Course creation is currently restricted to platform administrators.
        </Text>
        <Pressable
          style={{ backgroundColor: "#1769E0", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 }}
          onPress={() => router.back()}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0F172A" }}>
      <View style={styles.container}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 12 }}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={{ color: "#94A3B8", fontSize: 16 }}>← Back</Text>
          </Pressable>
          <Text style={[styles.title, { marginBottom: 0 }]}>Your submitted courses</Text>
        </View>
      <Pressable style={styles.newBtn} onPress={() => router.push("/instructor/new-course")}>
        <Text style={styles.newBtnText}>+ Submit a new course</Text>
      </Pressable>

      <FlatList
        data={courses}
        keyExtractor={(c) => c.id}
        onRefresh={load}
        refreshing={false}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={[styles.status, { color: STATUS_COLORS[item.reviewStatus] }]}>
              {item.reviewStatus.replace("_", " ")}
            </Text>
            {item.rejectionReason ? <Text style={styles.reason}>Reason: {item.rejectionReason}</Text> : null}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>You haven't submitted a course yet.</Text>}
      />
    </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 16 },
  newBtn: { backgroundColor: "#6366F1", borderRadius: 12, padding: 14, alignItems: "center", marginBottom: 20 },
  newBtnText: { color: "#fff", fontWeight: "700" },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginBottom: 10 },
  cardTitle: { color: "#fff", fontWeight: "600" },
  status: { marginTop: 6, fontWeight: "700", textTransform: "capitalize" },
  reason: { color: "#94A3B8", marginTop: 6, fontSize: 12 },
  empty: { color: "#64748B", textAlign: "center", marginTop: 40 },
});
