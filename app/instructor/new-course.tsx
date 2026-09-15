import { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { addDoc, collection, serverTimestamp, doc, setDoc } from "firebase/firestore";
import { router } from "expo-router";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { listCategories } from "@/services/courses";
import { Category } from "@/types";
import { ThumbnailPicker } from "@/components/ThumbnailPicker";
import { Ionicons } from "@expo/vector-icons";

export default function NewCourse() {
  const { profile } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [accessLink, setAccessLink] = useState("");
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listCategories().then((c) => {
      setCategories(c);
      if (c[0]) setCategoryId(c[0].id);
    });
  }, []);

  if (profile?.role !== "admin") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0F172A", justifyContent: "center", alignItems: "center", padding: 24 }}>
        <Ionicons name="lock-closed-outline" size={56} color="#6366F1" style={{ marginBottom: 16 }} />
        <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 8 }}>
          Submissions Closed
        </Text>
        <Text style={{ color: "#94A3B8", fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 24 }}>
          Course creation is currently restricted to platform administrators. Regular users cannot submit courses.
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

  async function onSubmit() {
    if (!title || !description || !price || !accessLink) {
      return Alert.alert("Missing info", "Please fill in Title, Description, Price, and Access Link.");
    }
    if (!categoryId) {
      return Alert.alert("Missing Category", "Please select a category.");
    }
    if (!profile) {
      return Alert.alert("Not signed in", "Please sign in again and retry.");
    }
    setBusy(true);
    try {
      let finalImageUrl = imageUrlInput.trim();

      if (!finalImageUrl) {
        setBusy(false);
        return Alert.alert("Missing Image URL", "Please upload an image using the web tool and paste the URL here.");
      }

      const courseRef = await addDoc(collection(db, "courses"), {
        categoryId,
        creatorUserId: profile.uid,
        title: title.trim(),
        slug: title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        description: description.trim(),
        image: finalImageUrl,
        price: parseFloat(price),
        status: "hidden",
        reviewStatus: "pending_review",
        rejectionReason: null,
        approvedAt: null,
        approvalRewarded: false,
        likeCount: 0,
        viewCount: 0,
        commentCount: 0,
        avgRating: 0,
        ratingCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // The real access link is stored separately so non-buyers can never
      // read it straight out of Firestore (see firestore.rules).
      await setDoc(doc(db, "course_access", courseRef.id), {
        creatorUserId: profile.uid,
        accessLink: accessLink.trim(),
      });
      Alert.alert("Submitted", "An admin will review your course shortly.");
      router.back();
    } catch (e: any) {
      Alert.alert("Submission failed", e.message ?? "Please try again.");
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
        else router.replace("/instructor");
      }} style={{ marginBottom: 16, marginTop: 8 }}>
        <Text style={{ color: "#94A3B8", fontSize: 16 }}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Submit a course</Text>

      <ThumbnailPicker uid={profile?.uid || ""} value={imageUrlInput} onChange={setImageUrlInput} />

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
        <Text style={styles.submitBtnText}>{busy ? "Submitting..." : "Submit for review"}</Text>
      </Pressable>
      <Text style={styles.note}>
        Your course goes live after an admin approves it. Approved courses earn a small wallet reward.
      </Text>
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
  submitBtn: { backgroundColor: "#6366F1", borderRadius: 12, padding: 16, alignItems: "center" },
  submitBtnText: { color: "#fff", fontWeight: "700" },
  note: { color: "#64748B", fontSize: 12, marginTop: 12, marginBottom: 40, textAlign: "center" },
});
