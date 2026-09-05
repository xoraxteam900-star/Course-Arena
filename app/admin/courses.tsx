import { useState, useEffect } from "react";
import { View, Text, FlatList, StyleSheet, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { collection, query, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { router } from "expo-router";
import { Course } from "@/types";

export default function AdminCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  
  async function load() {
    const snap = await getDocs(query(collection(db, "courses")));
    setCourses(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
  }

  useEffect(() => {
    load();
  }, []);

  async function deleteCourse(id: string) {
    Alert.alert("Delete Course", "This will permanently delete this course. Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await deleteDoc(doc(db, "courses", id));
          load();
        } catch(e: any) {
          Alert.alert("Error", e.message);
        }
      }}
    ]);
  }

  async function toggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === "published" ? "hidden" : "published";
    try {
      await updateDoc(doc(db, "courses", id), { status: newStatus });
      load();
    } catch(e: any) {
      Alert.alert("Error", e.message);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0F172A" }}>
    <View style={styles.container}>
      <Pressable onPress={() => {
        if (router.canGoBack()) router.back();
        else router.replace("/admin");
      }} style={{ marginBottom: 16 }}>
        <Text style={{ color: "#94A3B8", fontSize: 16 }}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Manage All Courses</Text>

      <FlatList
        data={courses}
        keyExtractor={(item) => item.id}
        onRefresh={load}
        refreshing={false}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardMeta}>Status: {item.status} | Review: {item.reviewStatus}</Text>
            <View style={styles.rowBtns}>
              <Pressable style={[styles.btn, styles.toggleBtn]} onPress={() => toggleStatus(item.id, item.status)}>
                <Text style={styles.btnText}>{item.status === "published" ? "Hide" : "Publish"}</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.editBtn]} onPress={() => router.push(`/admin/edit-course?id=${item.id}`)}>
                <Text style={styles.btnText}>Edit</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.deleteBtn]} onPress={() => deleteCourse(item.id)}>
                <Text style={styles.btnText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No courses found.</Text>}
      />
    </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800", marginBottom: 20 },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginBottom: 10 },
  cardTitle: { color: "#fff", fontWeight: "600", fontSize: 16 },
  cardMeta: { color: "#94A3B8", marginTop: 4, fontSize: 13 },
  rowBtns: { flexDirection: "row", gap: 8, marginTop: 12 },
  btn: { flex: 1, padding: 10, borderRadius: 8, alignItems: "center" },
  toggleBtn: { backgroundColor: "#6366F1" },
  editBtn: { backgroundColor: "#EAB308" },
  deleteBtn: { backgroundColor: "#F87171" },
  btnText: { color: "#0F172A", fontWeight: "700", fontSize: 13 },
  empty: { color: "#64748B", textAlign: "center", marginTop: 40 },
});
