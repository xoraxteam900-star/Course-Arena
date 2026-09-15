import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Image, TextInput, ActivityIndicator, Alert, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/firebase/config";
import { Ionicons } from "@expo/vector-icons";

type Mode = "url" | "firebase" | "infinityfree";

interface Props {
  uid: string;
  value: string;
  onChange: (url: string) => void;
  existingPreview?: string | null;
}

const INFINITYFREE_UPLOAD_URL =
  process.env.EXPO_PUBLIC_IMAGE_UPLOAD_URL || "https://your-infinityfree-domain.com/upload.php";

/**
 * Lets an admin/instructor set a course thumbnail three ways:
 *  - paste a direct image URL
 *  - pick a photo and upload it straight to Firebase Storage
 *  - pick a photo and upload it to their InfinityFree host via upload.php
 * All three converge on a single plain https URL stored on the course doc.
 */
export function ThumbnailPicker({ uid, value, onChange, existingPreview }: Props) {
  const [mode, setMode] = useState<Mode>("url");
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const preview = localPreview || value || existingPreview || null;

  async function pickAndUpload(target: "firebase" | "infinityfree") {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow photo library access to pick a thumbnail.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [16, 9],
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setLocalPreview(asset.uri);
    setUploading(true);
    try {
      const url =
        target === "firebase"
          ? await uploadToFirebase(uid, asset.uri)
          : await uploadToInfinityFree(asset.uri, asset.fileName || undefined);
      onChange(url);
    } catch (e: any) {
      Alert.alert("Upload failed", e?.message ?? "Please try again, or paste a URL instead.");
      setLocalPreview(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <View>
      <View style={styles.tabRow}>
        <TabButton label="Link" icon="link-outline" active={mode === "url"} onPress={() => setMode("url")} />
        <TabButton label="Firebase" icon="cloud-upload-outline" active={mode === "firebase"} onPress={() => setMode("firebase")} />
        <TabButton label="InfinityFree" icon="globe-outline" active={mode === "infinityfree"} onPress={() => setMode("infinityfree")} />
      </View>

      <View style={styles.previewBox}>
        {uploading ? (
          <ActivityIndicator color="#6366F1" />
        ) : preview ? (
          <Image source={{ uri: preview }} style={styles.previewImage} />
        ) : (
          <View style={{ alignItems: "center" }}>
            <Ionicons name="image-outline" size={28} color="#475569" />
            <Text style={styles.previewHint}>No thumbnail yet</Text>
          </View>
        )}
      </View>

      {mode === "url" && (
        <>
          <Text style={styles.hint}>Paste a direct image URL</Text>
          <TextInput
            style={styles.input}
            placeholder="https://example.com/thumb.jpg"
            placeholderTextColor="#64748B"
            autoCapitalize="none"
            value={value}
            onChangeText={(t) => { setLocalPreview(null); onChange(t); }}
          />
        </>
      )}

      {mode === "firebase" && (
        <Pressable style={styles.actionBtn} onPress={() => pickAndUpload("firebase")} disabled={uploading}>
          <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
          <Text style={styles.actionBtnText}>{uploading ? "Uploading…" : "Pick photo & upload to Firebase"}</Text>
        </Pressable>
      )}

      {mode === "infinityfree" && (
        <>
          <Pressable style={[styles.actionBtn, { backgroundColor: "#0EA5E9" }]} onPress={() => pickAndUpload("infinityfree")} disabled={uploading}>
            <Ionicons name="globe-outline" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>{uploading ? "Uploading…" : "Pick photo & upload to InfinityFree"}</Text>
          </Pressable>
          <Pressable
            style={styles.linkBtn}
            onPress={() =>
              Linking.openURL(INFINITYFREE_UPLOAD_URL).catch(() =>
                Alert.alert("Couldn't open link", "Check EXPO_PUBLIC_IMAGE_UPLOAD_URL in your .env.")
              )
            }
          >
            <Ionicons name="open-outline" size={15} color="#94A3B8" />
            <Text style={styles.linkBtnText}>Or open our upload page in the browser instead</Text>
          </Pressable>
          <Text style={styles.hint}>After it uploads there, copy the link and paste it in the "Link" tab.</Text>
        </>
      )}
    </View>
  );
}

function TabButton({ label, icon, active, onPress }: { label: string; icon: any; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <Ionicons name={icon} size={14} color={active ? "#fff" : "#94A3B8"} />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

async function uploadToFirebase(uid: string, localUri: string): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const ext = (localUri.split(".").pop() || "jpg").split("?")[0];
  // Storage rule requires the filename to start with the uploader's uid.
  const path = `course-images/${uid}_${Date.now()}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: blob.type || "image/jpeg" });
  return getDownloadURL(storageRef);
}

async function uploadToInfinityFree(localUri: string, fileName?: string): Promise<string> {
  const name = fileName || `thumb_${Date.now()}.jpg`;
  const ext = (name.split(".").pop() || "jpg").toLowerCase();
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";

  // Plain fetch()+FormData with a {uri,name,type} file part is unreliable on
  // React Native's New Architecture ("Unsupported FormDataPart implementation").
  // expo-file-system's UploadTask talks to the native networking layer directly
  // and is the supported way to do a real multipart file upload.
  const file = new FileSystem.File(localUri);
  const task = new FileSystem.UploadTask(file, INFINITYFREE_UPLOAD_URL, {
    httpMethod: "POST",
    uploadType: FileSystem.UploadType.MULTIPART,
    fieldName: "thumbnail",
    mimeType: mime,
  });
  const result = await task.uploadAsync();

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Upload server responded with status ${result.status}`);
  }

  let data: any;
  try {
    data = JSON.parse(result.body);
  } catch {
    throw new Error("Upload server returned an unexpected response");
  }
  if (!data.success || !data.url) {
    throw new Error(data.message || "InfinityFree upload failed");
  }
  return data.url as string;
}

const styles = StyleSheet.create({
  tabRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1, justifyContent: "center", paddingVertical: 10, borderRadius: 10, backgroundColor: "#1E293B" },
  tabActive: { backgroundColor: "#6366F1" },
  tabText: { color: "#94A3B8", fontSize: 12, fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  previewBox: { height: 140, backgroundColor: "#1E293B", borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 12, overflow: "hidden" },
  previewImage: { width: "100%", height: "100%" },
  previewHint: { color: "#64748B", fontSize: 12, marginTop: 6 },
  hint: { color: "#64748B", fontSize: 12, marginBottom: 8, textAlign: "center" },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 12, padding: 14, marginBottom: 12 },
  actionBtn: { flexDirection: "row", gap: 8, backgroundColor: "#6366F1", borderRadius: 12, padding: 14, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  actionBtnText: { color: "#fff", fontWeight: "700" },
  linkBtn: { flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingVertical: 8, marginBottom: 4 },
  linkBtnText: { color: "#94A3B8", fontSize: 12, textDecorationLine: "underline" },
});
