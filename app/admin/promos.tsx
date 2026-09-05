import { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, Alert, KeyboardAvoidingView, Platform, ScrollView, FlatList, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { collection, addDoc, getDocs, serverTimestamp, query, orderBy } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminPromos() {
  const { profile } = useAuth();
  const [courseId, setCourseId] = useState("");
  const [discount, setDiscount] = useState("100");
  const [maxClaims, setMaxClaims] = useState("10");
  const [hoursValid, setHoursValid] = useState("24");
  const [busy, setBusy] = useState(false);
  const [promos, setPromos] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [selectedCourseTitle, setSelectedCourseTitle] = useState("");

  useEffect(() => {
    loadPromos();
    loadCourses();
  }, []);

  async function loadCourses() {
    const snap = await getDocs(query(collection(db, "courses")));
    setCourses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function loadPromos() {
    const snap = await getDocs(query(collection(db, "promos"), orderBy("createdAt", "desc")));
    setPromos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  if (profile?.role !== "admin") return null;

  async function onCreate() {
    if (!courseId.trim()) return Alert.alert("Missing info", "Please enter a valid Course ID.");
    setBusy(true);
    try {
      await addDoc(collection(db, "promos"), {
        courseId: courseId.trim(),
        discountPercent: parseInt(discount) || 100,
        maxClaims: parseInt(maxClaims) || 10,
        claims: 0,
        hoursValid: parseInt(hoursValid) || 24,
        createdAt: serverTimestamp(),
      });
      Alert.alert("Success", "Promo created successfully!");
      setCourseId("");
      setSelectedCourseTitle("");
      loadPromos();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0F172A" }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView style={styles.container}>
          <Pressable onPress={() => router.back()} style={{ marginBottom: 16, marginTop: 8 }}>
            <Text style={{ color: "#94A3B8", fontSize: 16 }}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Create New Promo / Giveaway</Text>
          <Text style={styles.label}>Target Course</Text>
          <Pressable style={styles.dropdownBtn} onPress={() => setShowCourseModal(true)}>
            <Text style={{ color: selectedCourseTitle ? "#fff" : "#94A3B8" }}>
              {selectedCourseTitle || "Select a course..."}
            </Text>
          </Pressable>
          
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Discount % (100 = Free)</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={discount} onChangeText={setDiscount} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.label}>Max Claims (Users)</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={maxClaims} onChangeText={setMaxClaims} />
            </View>
          </View>
          <Text style={styles.label}>Valid for (Hours)</Text>
          <TextInput style={styles.input} keyboardType="numeric" value={hoursValid} onChangeText={setHoursValid} />
          
          <Pressable style={styles.btn} onPress={onCreate} disabled={busy}>
            <Text style={styles.btnText}>{busy ? "Creating..." : "Create Promo"}</Text>
          </Pressable>

          <Text style={[styles.title, { marginTop: 30, fontSize: 18 }]}>Active Promos</Text>
          {promos.map(p => (
            <View key={p.id} style={styles.card}>
              <Text style={styles.cardTitle}>Course: {p.courseId}</Text>
              <Text style={styles.cardMeta}>Discount: {p.discountPercent}%</Text>
              <Text style={styles.cardMeta}>Claims: {p.claims} / {p.maxClaims}</Text>
              <Text style={styles.cardMeta}>Duration: {p.hoursValid} hours</Text>
            </View>
          ))}
          {promos.length === 0 && <Text style={{ color: "#64748B", marginTop: 10 }}>No promos active.</Text>}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showCourseModal} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Course</Text>
            <FlatList
              data={courses}
              keyExtractor={(c) => c.id}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.courseItem}
                  onPress={() => {
                    setCourseId(item.id);
                    setSelectedCourseTitle(item.title);
                    setShowCourseModal(false);
                  }}
                >
                  <Text style={styles.courseItemText}>{item.title}</Text>
                </Pressable>
              )}
            />
            <Pressable style={styles.closeModalBtn} onPress={() => setShowCourseModal(false)}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 16 },
  label: { color: "#94A3B8", marginBottom: 6, fontSize: 13, fontWeight: "600" },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 12, padding: 14, marginBottom: 16 },
  row: { flexDirection: "row" },
  btn: { backgroundColor: "#EC4899", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
  btnText: { color: "#fff", fontWeight: "700" },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginBottom: 10 },
  cardTitle: { color: "#fff", fontWeight: "600" },
  cardMeta: { color: "#94A3B8", marginTop: 4, fontSize: 13 },
  dropdownBtn: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#334155" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#0F172A", height: "70%", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 16 },
  courseItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#1E293B" },
  courseItemText: { color: "#E2E8F0", fontSize: 16 },
  closeModalBtn: { backgroundColor: "#F87171", padding: 16, borderRadius: 12, alignItems: "center", marginTop: 16 },
});
