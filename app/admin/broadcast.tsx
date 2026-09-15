import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase/config";
import { Ionicons } from "@expo/vector-icons";

export interface BroadcastButton {
  id: string;
  label: string;
  type: "link" | "copy";
  value: string;
}

export default function AdminBroadcast() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [buttons, setButtons] = useState<BroadcastButton[]>([]);
  const [busy, setBusy] = useState(false);

  function handleAddButton() {
    if (buttons.length >= 3) {
      Alert.alert("Limit Reached", "You can attach a maximum of 3 action buttons.");
      return;
    }

    const newBtn: BroadcastButton = {
      id: `btn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: "",
      type: "link",
      value: "",
    };
    setButtons((prev) => [...prev, newBtn]);
  }

  function handleRemoveButton(id: string) {
    setButtons((prev) => prev.filter((b) => b.id !== id));
  }

  function handleUpdateButton(id: string, field: keyof BroadcastButton, val: string) {
    setButtons((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: val } : b))
    );
  }

  async function sendBroadcast() {
    if (!title.trim() || !message.trim()) {
      Alert.alert("Error", "Please enter both title and message.");
      return;
    }

    // Validate buttons if any
    const validButtons = buttons
      .map((b) => ({
        ...b,
        label: b.label.trim(),
        value: b.value.trim(),
      }))
      .filter((b) => b.label && b.value);

    for (const b of validButtons) {
      if (b.type === "link") {
        if (!b.value.startsWith("http://") && !b.value.startsWith("https://") && !b.value.includes("://")) {
          Alert.alert("Invalid URL", `Button "${b.label}" must have a valid URL (e.g. https://...).`);
          return;
        }
      }
    }

    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        message: message.trim(),
        buttons: validButtons,
        createdAt: serverTimestamp(),
      };

      // 1. Save to broadcasts for the real-time popup modal
      await addDoc(collection(db, "broadcasts"), payload);

      // 2. Also save to notifications collection so users can view it in their notification feed
      await addDoc(collection(db, "notifications"), {
        ...payload,
        targetUserId: null,
        type: "broadcast",
      });

      Alert.alert("Success", "Broadcast sent to all users with action buttons!");
      setTitle("");
      setMessage("");
      setButtons([]);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to send broadcast.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="megaphone-outline" size={36} color="#6366F1" />
          </View>
          <Text style={styles.title}>Send Broadcast</Text>
          <Text style={styles.subtitle}>
            This announcement will pop up for all users when they open the app and appear in their notifications.
          </Text>
        </View>

        <View style={styles.form}>
          {/* Title */}
          <Text style={styles.label}>Broadcast Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 🔥 Big Course Update & Promo Code"
            placeholderTextColor="#64748B"
            value={title}
            onChangeText={setTitle}
          />

          {/* Message */}
          <Text style={styles.label}>Message Body</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Write your broadcast announcement here..."
            placeholderTextColor="#64748B"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          {/* Action Buttons Section */}
          <View style={styles.buttonsHeaderRow}>
            <View>
              <Text style={styles.label}>Interactive Action Buttons</Text>
              <Text style={styles.helperText}>
                Attach links to open or coupon/text for users to copy
              </Text>
            </View>
            {buttons.length < 3 && (
              <Pressable style={styles.addBtnSmall} onPress={handleAddButton}>
                <Ionicons name="add" size={16} color="#6366F1" />
                <Text style={styles.addBtnSmallText}>Add Button</Text>
              </Pressable>
            )}
          </View>

          {buttons.map((btn, index) => (
            <View key={btn.id} style={styles.btnCard}>
              <View style={styles.btnCardHeader}>
                <Text style={styles.btnCardNumber}>Button #{index + 1}</Text>
                <Pressable
                  onPress={() => handleRemoveButton(btn.id)}
                  hitSlop={8}
                  style={styles.btnRemoveIcon}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </Pressable>
              </View>

              {/* Type Switcher */}
              <View style={styles.typeSwitcherRow}>
                <Pressable
                  style={[
                    styles.typePill,
                    btn.type === "link" && styles.typePillActive,
                  ]}
                  onPress={() => handleUpdateButton(btn.id, "type", "link")}
                >
                  <Ionicons
                    name="open-outline"
                    size={14}
                    color={btn.type === "link" ? "#FFFFFF" : "#94A3B8"}
                  />
                  <Text
                    style={[
                      styles.typePillText,
                      btn.type === "link" && styles.typePillTextActive,
                    ]}
                  >
                    Open Link URL
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.typePill,
                    btn.type === "copy" && styles.typePillActive,
                  ]}
                  onPress={() => handleUpdateButton(btn.id, "type", "copy")}
                >
                  <Ionicons
                    name="copy-outline"
                    size={14}
                    color={btn.type === "copy" ? "#FFFFFF" : "#94A3B8"}
                  />
                  <Text
                    style={[
                      styles.typePillText,
                      btn.type === "copy" && styles.typePillTextActive,
                    ]}
                  >
                    Copy Text / Code
                  </Text>
                </Pressable>
              </View>

              {/* Button Label */}
              <TextInput
                style={styles.subInput}
                placeholder="Button Label (e.g. 'Claim 50% Off' or 'Copy Code')"
                placeholderTextColor="#64748B"
                value={btn.label}
                onChangeText={(t) => handleUpdateButton(btn.id, "label", t)}
              />

              {/* Button Target / Value */}
              <TextInput
                style={styles.subInput}
                placeholder={
                  btn.type === "link"
                    ? "Target URL (e.g. https://...)"
                    : "Text to copy (e.g. ARENA50 or https://t.me/...)"
                }
                placeholderTextColor="#64748B"
                value={btn.value}
                onChangeText={(t) => handleUpdateButton(btn.id, "value", t)}
                autoCapitalize="none"
              />
            </View>
          ))}

          {/* Submit Broadcast Button */}
          <Pressable
            style={[styles.sendBtn, busy && { opacity: 0.6 }]}
            onPress={sendBroadcast}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#FFFFFF" />
                <Text style={styles.sendBtnText}>Send Broadcast to All Users</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1120",
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 26,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    paddingHorizontal: 12,
    lineHeight: 18,
  },
  form: {
    backgroundColor: "#131C31",
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  label: {
    color: "#E2E8F0",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
  },
  helperText: {
    color: "#94A3B8",
    fontSize: 12,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#0B1120",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 12,
    padding: 14,
    color: "#FFFFFF",
    fontSize: 15,
    marginBottom: 18,
  },
  textArea: {
    minHeight: 110,
  },
  buttonsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    marginBottom: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    paddingTop: 16,
  },
  addBtnSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnSmallText: {
    color: "#6366F1",
    fontSize: 12,
    fontWeight: "700",
  },
  btnCard: {
    backgroundColor: "#0B1120",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1E293B",
    padding: 12,
    marginBottom: 14,
  },
  btnCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  btnCardNumber: {
    color: "#A5B4FC",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  btnRemoveIcon: {
    padding: 4,
  },
  typeSwitcherRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  typePill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#131C31",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  typePillActive: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },
  typePillText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  typePillTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  subInput: {
    backgroundColor: "#131C31",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#FFFFFF",
    fontSize: 13,
    marginBottom: 8,
  },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#6366F1",
    padding: 16,
    borderRadius: 14,
    marginTop: 10,
  },
  sendBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
