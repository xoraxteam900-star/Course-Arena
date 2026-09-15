import { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { router, useLocalSearchParams } from "expo-router";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { listCategories } from "@/services/courses";
import { Category } from "@/types";
import { ThumbnailPicker } from "@/components/ThumbnailPicker";
import { normalizeImageUrl } from "@/utils/imageUrl";

export default function AdminEditCourse() {
  const { profile } = useAuth();
  const { id } = useLocalSearchParams();
  const courseId = typeof id === "string" ? id : "";
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [accessLink, setAccessLink] = useState("");
  const [existingImage, setExistingImage] = useState<string | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listCategories().then(setCategories);
    if (courseId) {
      getDoc(doc(db, "courses", courseId)).then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          setTitle(data.title || "");
          setDescription(data.description || "");
          setPrice(data.price?.toString() || "");
          setCategoryId(data.categoryId || "");
          setExistingImage(data.image || null);
        }
      });
      getDoc(doc(db, "course_access", courseId)).then(snap => {
        if (snap.exists()) {
          setAccessLink(snap.data().accessLink || "");
        }
      });
    }
  }, [courseId]);

  async function onSubmit() {
    if (!title || !description || !price || !accessLink || !categoryId) {
      return Alert.alert("Missing info", "Please fill in all fields.");
    }
    setBusy(true);
    try {
      let finalImageUrl = normalizeImageUrl(imageUrlInput.trim()) || existingImage;

      await updateDoc(doc(db, "courses", courseId), {
        title: title.trim(),
        description: description.trim(),
        price: parseFloat(price),
        categoryId,
        ...(finalImageUrl ? { image: finalImageUrl } : {}),
      });

      await updateDoc(doc(db, "course_access", courseId), {
        accessLink: accessLink.trim(),
      });
      
      Alert.alert("Updated", "Course updated successfully.");
      router.back();
    } catch (e: any) {
      Alert.alert("Failed to update", e.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0F172A" }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
      <Pressable onPress={() => {
        if (router.canGoBack()) router.back();
        else router.replace("/admin/courses");
      }} style={{ marginBottom: 16, marginTop: 8 }}>
        <Text style={{ color: "#94A3B8", fontSize: 16 }}>← Back</Text>
      </Pressable>
      
      <Text style={styles.title}>Edit Course</Text>

      <ThumbnailPicker uid={profile?.uid || ""} value={imageUrlInput} onChange={setImageUrlInput} existingPreview={existingImage} />

      <TextInput style={styles.input} placeholder="Course title" placeholderTextColor="#94A3B8" value={title} onChangeText={setTitle} />
      <TextInput style={[styles.input, { height: 100 }]} placeholder="Description" placeholderTextColor="#94A3B8" multiline value={description} onChangeText={setDescription} />
      <TextInput style={styles.input} placeholder="Price (GH₵)" placeholderTextColor="#94A3B8" keyboardType="numeric" value={price} onChangeText={setPrice} />
      <TextInput style={styles.input} placeholder="Access link (Drive, Telegram, etc.)" placeholderTextColor="#94A3B8" value={accessLink} onChangeText={setAccessLink} />

      <View style={styles.chipsRow}>
        {categories.map((c) => (
          <Pressable key={c.id} style={[styles.chip, categoryId === c.id && styles.chipActive]} onPress={() => setCategoryId(c.id)}>
            <Text style={[styles.chipText, categoryId === c.id && styles.chipTextActive]}>{c.name}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.submitBtn} onPress={onSubmit} disabled={busy}>
        <Text style={styles.submitBtnText}>{busy ? "Saving..." : "Save Changes"}</Text>
      </Pressable>
      <View style={{ height: 40 }} />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800", marginBottom: 16 },
  imagePicker: { height: 140, backgroundColor: "#1E293B", borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 16, overflow: "hidden" },
  imagePickerText: { color: "#94A3B8" },
  imagePreview: { width: "100%", height: "100%" },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 12, padding: 14, marginBottom: 12 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#1E293B", borderRadius: 20 },
  chipActive: { backgroundColor: "#6366F1" },
  chipText: { color: "#94A3B8", fontSize: 13 },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  submitBtn: { backgroundColor: "#EAB308", borderRadius: 12, padding: 16, alignItems: "center" },
  submitBtnText: { color: "#0F172A", fontWeight: "700" },
});
