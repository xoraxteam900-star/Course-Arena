import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import {
  Poll,
  listenToPolls,
  createPoll,
  closePoll,
  deletePoll,
} from "@/services/polls";

const DURATION_OPTIONS = [
  { label: "24 Hours", hours: 24 },
  { label: "3 Days", hours: 72 },
  { label: "7 Days", hours: 168 },
  { label: "14 Days", hours: 336 },
  { label: "30 Days", hours: 720 },
];

export default function AdminPolls() {
  const { profile } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [selectedDurationHours, setSelectedDurationHours] = useState(72); // Default 3 Days
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const unsub = listenToPolls((items) => {
      setPolls(items);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  function handleAddOption() {
    if (options.length >= 6) {
      Alert.alert("Limit Reached", "You can add a maximum of 6 options.");
      return;
    }
    setOptions((prev) => [...prev, ""]);
  }

  function handleRemoveOption(index: number) {
    if (options.length <= 2) {
      Alert.alert("Minimum Options", "A poll must have at least 2 options.");
      return;
    }
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  function handleOptionChange(text: string, index: number) {
    setOptions((prev) => {
      const copy = [...prev];
      copy[index] = text;
      return copy;
    });
  }

  async function handleCreatePoll() {
    if (!profile?.uid) return;
    if (!question.trim()) {
      Alert.alert("Required", "Please enter a poll question.");
      return;
    }

    const validOptions = options.map((o) => o.trim()).filter(Boolean);
    if (validOptions.length < 2) {
      Alert.alert("Required", "Please provide at least 2 non-empty options.");
      return;
    }

    setCreating(true);
    try {
      await createPoll({
        question: question.trim(),
        options: validOptions,
        durationHours: selectedDurationHours,
        createdBy: profile.uid,
      });
      Alert.alert("Success", "Poll published successfully!");
      setShowCreateModal(false);
      setQuestion("");
      setOptions(["", ""]);
      setSelectedDurationHours(72);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to create poll.");
    } finally {
      setCreating(false);
    }
  }

  async function handleClosePoll(pollId: string) {
    Alert.alert("End Poll", "Are you sure you want to end this poll early?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End Poll",
        style: "destructive",
        onPress: async () => {
          try {
            await closePoll(pollId);
          } catch (err: any) {
            Alert.alert("Error", err.message || "Could not close poll.");
          }
        },
      },
    ]);
  }

  async function handleDeletePoll(pollId: string) {
    Alert.alert("Delete Poll", "Are you sure you want to permanently delete this poll?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePoll(pollId);
          } catch (err: any) {
            Alert.alert("Error", err.message || "Could not delete poll.");
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace("/admin");
            }}
            hitSlop={8}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Poll Voting System</Text>
            <Text style={styles.subtitle}>Create & manage community polls with end timers</Text>
          </View>
          <Pressable
            style={styles.createBtn}
            onPress={() => setShowCreateModal(true)}
            hitSlop={6}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.createBtnText}>New Poll</Text>
          </Pressable>
        </View>

        {/* Polls List */}
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#6366F1" />
          </View>
        ) : (
          <FlatList
            data={polls}
            keyExtractor={(p) => p.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const now = Date.now();
              const expMs = item.expiresAt?.toMillis
                ? item.expiresAt.toMillis()
                : item.expiresAt
                ? new Date(item.expiresAt).getTime()
                : 0;
              const isEnded = item.status === "ended" || (expMs > 0 && expMs <= now);
              const total = item.totalVotes || 0;

              return (
                <View style={styles.pollCard}>
                  {/* Status & Expiry Banner */}
                  <View style={styles.cardHeader}>
                    <View style={styles.statusPill}>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: isEnded ? "#EF4444" : "#10B981" },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          { color: isEnded ? "#EF4444" : "#10B981" },
                        ]}
                      >
                        {isEnded ? "Ended" : "Active"}
                      </Text>
                    </View>

                    {item.expiresAt && (
                      <Text style={styles.expiryDateText}>
                        {isEnded ? "Ended on " : "Ends on "}
                        {new Date(expMs).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    )}
                  </View>

                  {/* Question */}
                  <Text style={styles.cardQuestion}>{item.question}</Text>

                  {/* Options with percentages */}
                  <View style={styles.cardOptionsContainer}>
                    {item.options.map((opt) => {
                      const count = opt.votes || 0;
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;

                      return (
                        <View key={opt.id} style={styles.adminOptionRow}>
                          <View style={styles.adminOptionTop}>
                            <Text style={styles.adminOptionText}>{opt.text}</Text>
                            <Text style={styles.adminOptionPct}>
                              {pct}% ({count})
                            </Text>
                          </View>
                          <View style={styles.adminBarTrack}>
                            <View
                              style={[
                                styles.adminBarFill,
                                { width: `${pct}%` },
                              ]}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  {/* Card Actions */}
                  <View style={styles.cardActionsRow}>
                    <Text style={styles.votesTotalText}>
                      👥 {total.toLocaleString()} total votes
                    </Text>

                    <View style={styles.cardButtonsRight}>
                      {!isEnded && (
                        <Pressable
                          style={styles.endEarlyBtn}
                          onPress={() => handleClosePoll(item.id)}
                        >
                          <Text style={styles.endEarlyBtnText}>End Early</Text>
                        </Pressable>
                      )}
                      <Pressable
                        style={styles.deletePollBtn}
                        onPress={() => handleDeletePoll(item.id)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="bar-chart-outline" size={48} color="#64748B" />
                <Text style={styles.emptyTitle}>No Polls Created Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Create a poll for your users to vote on upcoming courses and features!
                </Text>
              </View>
            }
          />
        )}

        {/* CREATE POLL MODAL */}
        <Modal
          visible={showCreateModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCreateModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalSheetTitle}>Create New Poll</Text>
                <Pressable onPress={() => setShowCreateModal(false)} hitSlop={8}>
                  <Ionicons name="close" size={24} color="#94A3B8" />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Question Input */}
                <Text style={styles.inputLabel}>Poll Question</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Which course topic should we build next?"
                  placeholderTextColor="#64748B"
                  value={question}
                  onChangeText={setQuestion}
                  multiline
                />

                {/* Options Section */}
                <View style={styles.optionsHeaderRow}>
                  <Text style={styles.inputLabel}>Voting Options (2 - 6)</Text>
                  {options.length < 6 && (
                    <Pressable
                      style={styles.addOptionSmallBtn}
                      onPress={handleAddOption}
                    >
                      <Ionicons name="add" size={14} color="#6366F1" />
                      <Text style={styles.addOptionSmallText}>Add Option</Text>
                    </Pressable>
                  )}
                </View>

                {options.map((optText, index) => (
                  <View key={`opt-input-${index}`} style={styles.optionInputRow}>
                    <TextInput
                      style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
                      placeholder={`Option ${index + 1}`}
                      placeholderTextColor="#64748B"
                      value={optText}
                      onChangeText={(t) => handleOptionChange(t, index)}
                    />
                    {options.length > 2 && (
                      <Pressable
                        onPress={() => handleRemoveOption(index)}
                        hitSlop={8}
                        style={styles.removeOptBtn}
                      >
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </Pressable>
                    )}
                  </View>
                ))}

                {/* Duration / Expiry Selector */}
                <Text style={[styles.inputLabel, { marginTop: 18 }]}>
                  Poll Duration (Time for it to end)
                </Text>
                <View style={styles.durationsGrid}>
                  {DURATION_OPTIONS.map((d) => {
                    const isSelected = selectedDurationHours === d.hours;
                    return (
                      <Pressable
                        key={`dur-${d.hours}`}
                        style={[
                          styles.durationPill,
                          isSelected && styles.durationPillSelected,
                        ]}
                        onPress={() => setSelectedDurationHours(d.hours)}
                      >
                        <Text
                          style={[
                            styles.durationText,
                            isSelected && styles.durationTextSelected,
                          ]}
                        >
                          {d.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Submit Button */}
                <Pressable
                  style={styles.submitPollBtn}
                  onPress={handleCreatePoll}
                  disabled={creating}
                >
                  {creating ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                      <Text style={styles.submitPollText}>Publish Poll</Text>
                    </>
                  )}
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B1120",
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  subtitle: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#6366F1",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  createBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  centerLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingBottom: 40,
    gap: 14,
  },
  pollCard: {
    backgroundColor: "#131C31",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1E293B",
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  expiryDateText: {
    fontSize: 11,
    color: "#94A3B8",
  },
  cardQuestion: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 14,
  },
  cardOptionsContainer: {
    gap: 10,
    marginBottom: 14,
  },
  adminOptionRow: {
    gap: 4,
  },
  adminOptionTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  adminOptionText: {
    fontSize: 13,
    color: "#E2E8F0",
    fontWeight: "500",
  },
  adminOptionPct: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "600",
  },
  adminBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
  },
  adminBarFill: {
    height: "100%",
    backgroundColor: "#6366F1",
    borderRadius: 3,
  },
  cardActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  votesTotalText: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "500",
  },
  cardButtonsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  endEarlyBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  endEarlyBtnText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "600",
  },
  deletePollBtn: {
    padding: 6,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    maxWidth: 260,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#131C31",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 36,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalSheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E2E8F0",
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: "#0B1120",
    color: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#1E293B",
    fontSize: 14,
    marginBottom: 12,
  },
  optionsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  addOptionSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
  },
  addOptionSmallText: {
    color: "#6366F1",
    fontSize: 12,
    fontWeight: "600",
  },
  optionInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  removeOptBtn: {
    padding: 8,
  },
  durationsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  durationPill: {
    backgroundColor: "#0B1120",
    borderWidth: 1,
    borderColor: "#1E293B",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  durationPillSelected: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },
  durationText: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
  },
  durationTextSelected: {
    color: "#FFFFFF",
  },
  submitPollBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#6366F1",
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
  },
  submitPollText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
