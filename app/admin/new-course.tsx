import { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, Alert, Image, KeyboardAvoidingView, Platform, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { auth } from "@/firebase/config";
import { addDoc, collection, serverTimestamp, doc, setDoc } from "firebase/firestore";
import { router } from "expo-router";
import { storage, db, app } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { listCategories } from "@/services/courses";
import { Category } from "@/types";

export default function AdminNewCourse() {
  const { profile } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [accessLink, setAccessLink] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
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
      <View style={styles.container}>
        <Text style={styles.denied}>Admin access only.</Text>
      </View>
    );
  }

  async function pickImage() {
    const uploadUrl = process.env.EXPO_PUBLIC_IMAGE_UPLOAD_URL || "https://your-infinityfree-domain.com/upload.php";
    Linking.openURL(uploadUrl).catch(() => {
      Alert.alert("Error", "Could not open the browser. Please visit the upload URL manually.");
    });
  }

  async function onSubmit() {
    if (!title || !description || !price || !accessLink) {
      return Alert.alert("Missing info", "Please fill in Title, Description, Price, and Access Link.");
    }
    if (!categoryId) {
      return Alert.alert("Missing Category", "Please select a category. If none exist, create one first.");
    }
    setBusy(true);
    try {
      let finalImageUrl = imageUrlInput.trim();

      if (!finalImageUrl) {
        setBusy(false);
        return Alert.alert("Missing Image URL", "Please upload an image using the web tool and paste the URL here.");
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

      <Pressable style={styles.imagePicker} onPress={pickImage}>
        <Text style={styles.imagePickerText}>🌐 Upload Thumbnail via Web</Text>
        <Text style={{ color: "#64748B", fontSize: 11, marginTop: 4 }}>Opens your InfinityFree portal to upload safely</Text>
      </Pressable>

      <Text style={{color: "#64748B", textAlign: "center", marginBottom: 12, marginTop: -4}}>Paste the copied URL here:</Text>
      <TextInput style={styles.input} placeholder="https://example.com/uploads/thumb..." placeholderTextColor="#94A3B8" value={imageUrlInput} onChangeText={setImageUrlInput} autoCapitalize="none" />


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
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#1E293B", borderRadius: 20 },
  chipActive: { backgroundColor: "#6366F1" },
  chipText: { color: "#94A3B8", fontSize: 13 },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  submitBtn: { backgroundColor: "#22C55E", borderRadius: 12, padding: 16, alignItems: "center" },
  submitBtnText: { color: "#0F172A", fontWeight: "700" },
});
