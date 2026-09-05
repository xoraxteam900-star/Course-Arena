import { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, FlatList, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { router } from "expo-router";
import { Category } from "@/types";

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCat, setNewCat] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const snap = await getDocs(collection(db, "categories"));
    setCategories(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
  }

  useEffect(() => {
    load();
  }, []);

  async function createCategory() {
    if (!newCat.trim()) return;
    setBusy(true);
    try {
      await addDoc(collection(db, "categories"), { name: newCat.trim() });
      setNewCat("");
      load();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteCat(id: string) {
    Alert.alert("Delete Category", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await deleteDoc(doc(db, "categories", id));
        load();
      }}
    ]);
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
      
      <Text style={styles.title}>Manage Categories</Text>

      <View style={styles.inputRow}>
        <TextInput 
          style={styles.input} 
          placeholder="New Category Name" 
          placeholderTextColor="#94A3B8" 
          value={newCat} 
          onChangeText={setNewCat} 
        />
        <Pressable style={styles.addBtn} onPress={createCategory} disabled={busy}>
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardText}>{item.name}</Text>
            <Pressable style={styles.deleteBtn} onPress={() => deleteCat(item.id)}>
              <Text style={styles.deleteBtnText}>Delete</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800", marginBottom: 20 },
  inputRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  input: { flex: 1, backgroundColor: "#1E293B", color: "#fff", borderRadius: 12, padding: 14 },
  addBtn: { backgroundColor: "#6366F1", justifyContent: "center", paddingHorizontal: 20, borderRadius: 12 },
  addBtnText: { color: "#fff", fontWeight: "700" },
  card: { flexDirection: "row", backgroundColor: "#1E293B", padding: 16, borderRadius: 12, marginBottom: 10, alignItems: "center", justifyContent: "space-between" },
  cardText: { color: "#fff", fontSize: 16 },
  deleteBtn: { backgroundColor: "#F87171", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  deleteBtnText: { color: "#0F172A", fontWeight: "700", fontSize: 13 },
});
