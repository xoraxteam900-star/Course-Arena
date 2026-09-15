import { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { addDoc, collection, serverTimestamp, doc, setDoc } from "firebase/firestore";
import { router, useLocalSearchParams } from "expo-router";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { listCategories } from "@/services/courses";
import { Category } from "@/types";
import { ThumbnailPicker } from "@/components/ThumbnailPicker";
import { normalizeImageUrl } from "@/utils/imageUrl";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

export default function AdminNewCourse() {
  const { profile } = useAuth();
  const params = useLocalSearchParams<{ prefillTitle?: string; prefillDescription?: string; prefillAccessLink?: string }>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState(params.prefillTitle || "");
  const [description, setDescription] = useState(params.prefillDescription || "");
  const [price, setPrice] = useState("");
  const [accessLink, setAccessLink] = useState(params.prefillAccessLink || "");
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (params.prefillTitle && !title) setTitle(params.prefillTitle);
    if (params.prefillDescription && !description) setDescription(params.prefillDescription);
    if (params.prefillAccessLink && !accessLink) setAccessLink(params.prefillAccessLink);
  }, [params]);

  useEffect(() => {
    listCategories().then((c) => {
      setCategories(c);
      if (c[0]) setCategoryId(c[0].id);
    });
    AsyncStorage.getItem("@admin_ai_description_enabled")
      .then(val => setAiEnabled(val === "true"))
      .catch(() => {});
  }, []);

  if (profile?.role !== "admin") {
    return (
      <View style={styles.container}>
        <Text style={styles.denied}>Admin access only.</Text>
      </View>
    );
  }

  const generateDescription = async () => {
    if (!title.trim()) {
      return Alert.alert("Missing Title", "Please enter a course title first so the AI knows what to write about.");
    }
    setAiLoading(true);
    try {
      const q = `Write a compelling, professional 3-sentence description for a course titled: ${title}`;
      const res = await fetch(`https://api-rebix.zone.id/api/claude-session?q=${encodeURIComponent(q)}`);
      const text = await res.text();
      let finalContent = text;
      try {
        const json = JSON.parse(text);
        if (json.message) finalContent = json.message;
        else if (json.result) finalContent = json.result;
        else if (json.response) finalContent = json.response;
        else if (typeof json === "string") finalContent = json;
      } catch (e) {}
      setDescription(finalContent);
    } catch (e) {
      Alert.alert("AI Error", "Failed to connect to the AI Assistant.");
    } finally {
      setAiLoading(false);
    }
  };

  async function onSubmit() {
    if (!title || !description || !price || !accessLink) {
      return Alert.alert("Missing info", "Please fill in Title, Description, Price, and Access Link.");
    }
    if (!categoryId) {
      return Alert.alert("Missing Category", "Please select a category. If none exist, create one first.");
    }
    if (!profile) {
      return Alert.alert("Not signed in", "Please sign in again and retry.");
    }
    setBusy(true);
    try {
      let finalImageUrl = normalizeImageUrl(imageUrlInput.trim());

      if (!finalImageUrl) {
        setBusy(false);
        return Alert.alert("Missing Image URL", "Please upload an image or paste an image URL.");
      }

      // Admin-authored courses go live immediately - no review queue,
      // creatorUserId is set to profile.uid.
      const courseRef = await addDoc(collection(db, "courses"), {
        categoryId,
        creatorUserId: profile.uid,
        title: title.trim(),
        slug: title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        description: description.trim(),
        image: finalImageUrl,
        price: parseFloat(price),
        status: "published",
        reviewStatus: "approved",
        rejectionReason: null,
        approvedAt: serverTimestamp(),
        approvalRewarded: true,
        likeCount: 0,
        viewCount: 0,
        commentCount: 0,
        avgRating: 0,
        ratingCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, "course_access", courseRef.id), {
        creatorUserId: profile.uid,
        accessLink: accessLink.trim(),
      });
      Alert.alert("Published", "The course is live now.");
      router.back();
    } catch (e: any) {
      Alert.alert("Failed to publish", e.message ?? "Please try again.");
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
        else router.replace("/admin");
      }} style={{ marginBottom: 16, marginTop: 8 }}>
        <Text style={{ color: "#94A3B8", fontSize: 16 }}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Add a course</Text>

      <ThumbnailPicker uid={profile.uid} value={imageUrlInput} onChange={setImageUrlInput} />

      <TextInput style={styles.input} placeholder="Course title" placeholderTextColor="#94A3B8" value={title} onChangeText={setTitle} />
      
      {aiEnabled && (
        <View style={styles.aiGenRow}>
          <Text style={{ color: "#94A3B8", fontSize: 13, flex: 1 }}>AI Auto-Description</Text>
          <Pressable style={styles.aiGenBtn} onPress={generateDescription} disabled={aiLoading}>
            {aiLoading ? <Text style={styles.aiGenBtnText}>Generating...</Text> : (
              <>
                <Ionicons name="sparkles" size={14} color="#fff" />
                <Text style={styles.aiGenBtnText}>Generate</Text>
              </>
            )}
          </Pressable>
        </View>
      )}
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
        <Text style={styles.submitBtnText}>{busy ? "Publishing..." : "Publish course"}</Text>
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
  denied: { color: "#64748B", textAlign: "center", marginTop: 60 },
  imagePicker: { height: 140, backgroundColor: "#1E293B", borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 16, overflow: "hidden" },
  imagePickerText: { color: "#94A3B8" },
  imagePreview: { width: "100%", height: "100%" },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 12, padding: 14, marginBottom: 12 },
  aiGenRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, paddingHorizontal: 4 },
  aiGenBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#6366F1", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  aiGenBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#1E293B", borderRadius: 20 },
  chipActive: { backgroundColor: "#6366F1" },
  chipText: { color: "#94A3B8", fontSize: 13 },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  submitBtn: { backgroundColor: "#22C55E", borderRadius: 12, padding: 16, alignItems: "center" },
  submitBtnText: { color: "#0F172A", fontWeight: "700" },
});
