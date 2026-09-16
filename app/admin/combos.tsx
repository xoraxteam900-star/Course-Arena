import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Alert, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { listPublishedCourses } from "@/services/courses";
import { Course } from "@/types";
import { createComboGiveaway, getActiveCombo, deactivateCombo, ComboGiveaway } from "@/services/combos";
import { normalizeImageUrl } from "@/utils/imageUrl";

export default function AdminCombosScreen() {
  const { colors, isDark } = useTheme();
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comboTitle, setComboTitle] = useState("ULTIMATE GIVEAWAY COMBO");
  const [comboPrice, setComboPrice] = useState("50");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [activeCombo, setActiveCombo] = useState<ComboGiveaway | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const allCourses = await listPublishedCourses({ max: 100 });
      setCourses(allCourses);
      
      const current = await getActiveCombo();
      setActiveCombo(current);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      if (selectedIds.length >= 3) {
        Alert.alert("Limit Reached", "You can only select up to 3 courses for a combo.");
        return;
      }
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleCreate = async () => {
    if (selectedIds.length !== 3) {
      Alert.alert("Error", "Please select exactly 3 courses.");
      return;
    }
    const priceNum = parseFloat(comboPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      Alert.alert("Error", "Please enter a valid price.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createComboGiveaway(comboTitle, selectedIds, priceNum);
      Alert.alert("Success", "Giveaway Combo created and activated for all users!");
      setSelectedIds([]);
      setComboPrice("50");
      loadData();
    } catch (e) {
      Alert.alert("Error", "Failed to create combo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!activeCombo) return;
    try {
      await deactivateCombo(activeCombo.id);
      Alert.alert("Success", "Giveaway combo deactivated.");
      loadData();
    } catch (e) {
      Alert.alert("Error", "Failed to deactivate combo.");
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Giveaways & Combos</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
        
        {/* CURRENT ACTIVE COMBO STATUS */}
        <View style={[styles.statusCard, { backgroundColor: activeCombo ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)", borderColor: activeCombo ? "#10B981" : "#EF4444" }]}>
          <Text style={[styles.statusText, { color: activeCombo ? "#10B981" : "#EF4444" }]}>
            {activeCombo ? `🔥 ACTIVE: ${activeCombo.title} (GH₵ ${activeCombo.price})` : "NO ACTIVE COMBOS"}
          </Text>
          {activeCombo && (
            <Pressable style={styles.stopBtn} onPress={handleDeactivate}>
              <Text style={styles.stopBtnText}>Stop Giveaway</Text>
            </Pressable>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>Create New Combo</Text>
        <Text style={{ color: colors.textDim, marginBottom: 20, fontSize: 13 }}>
          Select exactly 3 courses below to bundle into a limited-time popup giveaway for users. Note: creating a new combo will overlap the current one.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Combo Title</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
            value={comboTitle}
            onChangeText={setComboTitle}
            placeholder="e.g. ULTIMATE BEGINNER PACK"
            placeholderTextColor={colors.textDim}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Combo Price (GH₵)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
            value={comboPrice}
            onChangeText={setComboPrice}
            keyboardType="numeric"
            placeholder="e.g. 50"
            placeholderTextColor={colors.textDim}
          />
        </View>

        <View style={styles.selectedPills}>
          <Text style={[styles.label, { color: colors.text }]}>Selected ({selectedIds.length}/3):</Text>
          {selectedIds.length === 0 && <Text style={{ color: colors.textDim, fontSize: 12 }}>None</Text>}
          {selectedIds.map(id => {
            const c = courses.find(x => x.id === id);
            return (
              <View key={id} style={styles.pill}>
                <Text style={styles.pillText} numberOfLines={1}>{c?.title}</Text>
                <Pressable onPress={() => toggleSelection(id)}>
                  <Ionicons name="close-circle" size={16} color="#FFF" />
                </Pressable>
              </View>
            );
          })}
        </View>

        {loading ? (
          <ActivityIndicator color="#6366F1" style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.courseList}>
            {courses.map(course => {
              const isSelected = selectedIds.includes(course.id);
              return (
                <Pressable 
                  key={course.id} 
                  style={[
                    styles.courseCard, 
                    { backgroundColor: colors.card, borderColor: isSelected ? "#6366F1" : colors.border }
                  ]}
                  onPress={() => toggleSelection(course.id)}
                >
                  <Image source={{ uri: normalizeImageUrl(course.image) }} style={styles.courseImg} />
                  <View style={styles.courseInfo}>
                    <Text style={[styles.courseTitle, { color: colors.text }]} numberOfLines={2}>{course.title}</Text>
                    <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 4 }}>GH₵ {course.price}</Text>
                  </View>
                  <View style={[styles.checkCircle, { borderColor: isSelected ? "#6366F1" : colors.textDim, backgroundColor: isSelected ? "#6366F1" : "transparent" }]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color="#FFF" />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable 
          style={[styles.createBtn, (selectedIds.length !== 3 || isSubmitting) && { opacity: 0.5 }]} 
          onPress={handleCreate}
          disabled={selectedIds.length !== 3 || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="rocket" size={20} color="#FFF" />
              <Text style={styles.createBtnText}>Launch Giveaway</Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  
  statusCard: { padding: 16, borderRadius: 12, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusText: { fontSize: 14, fontWeight: "700" },
  stopBtn: { backgroundColor: "rgba(239, 68, 68, 0.2)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  stopBtnText: { color: "#EF4444", fontWeight: "700", fontSize: 12 },

  sectionTitle: { fontSize: 20, fontWeight: "800" },
  
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, fontWeight: "600" },

  selectedPills: { marginBottom: 20 },
  pill: { flexDirection: "row", alignItems: "center", backgroundColor: "#6366F1", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, gap: 6, marginTop: 6 },
  pillText: { color: "#FFF", fontSize: 12, fontWeight: "600", maxWidth: 200 },

  courseList: { gap: 12, paddingBottom: 40 },
  courseCard: { flexDirection: "row", padding: 10, borderRadius: 12, borderWidth: 2, alignItems: "center", gap: 12 },
  courseImg: { width: 60, height: 60, borderRadius: 8, backgroundColor: "#1E293B" },
  courseInfo: { flex: 1 },
  courseTitle: { fontSize: 14, fontWeight: "600" },
  checkCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },

  footer: { padding: 16, borderTopWidth: 1 },
  createBtn: { backgroundColor: "#6366F1", paddingVertical: 16, borderRadius: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10 },
  createBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
});
