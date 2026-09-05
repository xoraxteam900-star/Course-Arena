import { useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminNotifications() {
  const { profile } = useAuth();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  if (profile?.role !== "admin") return null;

  async function onSend() {
    if (!title.trim() || !message.trim()) {
      return Alert.alert("Missing info", "Please enter both title and message.");
    }
    setBusy(true);
    try {
      await addDoc(collection(db, "notifications"), {
        title: title.trim(),
        message: message.trim(),
        type: "system",
        targetUserId: null,
        createdAt: serverTimestamp(),
      });
      Alert.alert("Sent", "Notification broadcasted to all users!");
      setTitle("");
      setMessage("");
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
          <Text style={styles.title}>Send Broadcast Notification</Text>
          <Text style={styles.desc}>This will appear in the Notifications tab for every user on the platform.</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Notification Title"
            placeholderTextColor="#94A3B8"
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={[styles.input, { height: 120 }]}
            placeholder="Message body..."
            placeholderTextColor="#94A3B8"
            multiline
            value={message}
            onChangeText={setMessage}
          />
          
          <Pressable style={styles.sendBtn} onPress={onSend} disabled={busy}>
            <Text style={styles.sendBtnText}>{busy ? "Sending..." : "Broadcast Notification"}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 8 },
  desc: { color: "#94A3B8", marginBottom: 24, lineHeight: 20 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 12, padding: 14, marginBottom: 16 },
  sendBtn: { backgroundColor: "#6366F1", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
  sendBtnText: { color: "#fff", fontWeight: "700" },
});
