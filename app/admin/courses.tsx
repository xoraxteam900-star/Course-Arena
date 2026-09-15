import { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { collection, query, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Course, Category } from "@/types";
import { listCategories, togglePinCourseInCategory } from "@/services/courses";

export default function AdminCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pinningId, setPinningId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [courseSnap, cats] = await Promise.all([
        getDocs(query(collection(db, "courses"))),
        listCategories(),
      ]);

      setCourses(courseSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setCategories(cats);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to load courses");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function deleteCourse(id: string) {
    Alert.alert("Delete Course", "This will permanently delete this course. Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "courses", id));
            load();
          } catch (e: any) {
            Alert.alert("Error", e.message);
          }
        },
      },
    ]);
  }

  async function toggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === "published" ? "hidden" : "published";
    try {
      await updateDoc(doc(db, "courses", id), { status: newStatus });
      load();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  }

  async function handleTogglePin(course: Course) {
    if (!course.categoryId) {
      Alert.alert("No Category", "This course doesn't belong to a category. Please edit it to assign one.");
      return;
    }

    setPinningId(course.id);
    try {
      const isPinned = await togglePinCourseInCategory(course.categoryId, course.id);
      Alert.alert(
        isPinned ? "📌 Course Pinned" : "📌 Course Unpinned",
        isPinned
          ? `"${course.title}" is now pinned in its category! (Max 3)`
          : `"${course.title}" was unpinned.`
      );
      load();
    } catch (err: any) {
      Alert.alert("Pin Limit Reached", err.message || "Could not pin course.");
    } finally {
      setPinningId(null);
    }
  }

  // Filter courses by category
  const filteredCourses = useMemo(() => {
    if (!selectedCategoryId) return courses;
    return courses.filter((c) => c.categoryId === selectedCategoryId);
  }, [courses, selectedCategoryId]);

  // Selected category metadata
  const currentCategory = useMemo(() => {
    if (!selectedCategoryId) return null;
    return categories.find((c) => c.id === selectedCategoryId) || null;
  }, [categories, selectedCategoryId]);

  const pinnedIdsInCurrentCat = useMemo(() => {
    if (!currentCategory) return new Set<string>();
    return new Set(currentCategory.pinnedCourseIds || []);
  }, [currentCategory]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
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
            <Text style={styles.title}>Manage Courses & Pins</Text>
            <Text style={styles.subtitle}>
              Pin up to 3 courses per category to feature them at the top
            </Text>
          </View>
        </View>

        {/* Category Selector Pills */}
        <View style={styles.catSelectorWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll}>
            <Pressable
              style={[
                styles.catPill,
                selectedCategoryId === null && styles.catPillActive,
              ]}
              onPress={() => setSelectedCategoryId(null)}
            >
              <Text
                style={[
                  styles.catPillText,
                  selectedCategoryId === null && styles.catPillTextActive,
                ]}
              >
                All ({courses.length})
              </Text>
            </Pressable>

            {categories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id;
              const count = courses.filter((c) => c.categoryId === cat.id).length;
              const pinnedCount = (cat.pinnedCourseIds || []).length;

              return (
                <Pressable
                  key={cat.id}
                  style={[styles.catPill, isSelected && styles.catPillActive]}
                  onPress={() => setSelectedCategoryId(cat.id)}
                >
                  <Text style={[styles.catPillText, isSelected && styles.catPillTextActive]}>
                    {cat.name} ({count}) {pinnedCount > 0 ? `📌${pinnedCount}/3` : ""}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Category Pinning Info Banner */}
        {currentCategory && (
          <View style={styles.categoryPinBanner}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="pin" size={16} color="#FBBF24" />
              <Text style={styles.categoryPinTitle}>
                {currentCategory.name} Pins: {(currentCategory.pinnedCourseIds || []).length} / 3
              </Text>
            </View>
            <Text style={styles.categoryPinDesc}>
              {(currentCategory.pinnedCourseIds || []).length >= 3
                ? "Maximum 3 courses pinned. Unpin one to pin another."
                : "Tap 'Pin' on any course below to feature it at the top."}
            </Text>
          </View>
        )}

        {/* Courses List */}
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#6366F1" />
          </View>
        ) : (
          <FlatList
            data={filteredCourses}
            keyExtractor={(item) => item.id}
            onRefresh={load}
            refreshing={loading}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const cat = categories.find((c) => c.id === item.categoryId);
              const isPinned = cat?.pinnedCourseIds?.includes(item.id);

              return (
                <View style={[styles.card, isPinned && styles.cardPinned]}>
                  <View style={styles.cardTopRow}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        {isPinned && (
                          <View style={styles.pinnedBadge}>
                            <Ionicons name="pin" size={11} color="#0F172A" />
                            <Text style={styles.pinnedBadgeText}>PINNED (TOP 3)</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.cardMeta}>
                        {cat?.name || "Uncategorized"} • Status: {item.status} • ★{" "}
                        {item.avgRating ? item.avgRating.toFixed(1) : "0.0"} ({item.ratingCount ?? 0})
                      </Text>
                    </View>
                  </View>

                  <View style={styles.rowBtns}>
                    {/* Pin/Unpin button */}
                    <Pressable
                      style={[
                        styles.btn,
                        isPinned ? styles.unpinBtn : styles.pinBtn,
                      ]}
                      onPress={() => handleTogglePin(item)}
                      disabled={pinningId === item.id}
                    >
                      {pinningId === item.id ? (
                        <ActivityIndicator size="small" color="#0F172A" />
                      ) : (
                        <>
                          <Ionicons
                            name="pin"
                            size={14}
                            color={isPinned ? "#FFFFFF" : "#0F172A"}
                          />
                          <Text
                            style={[
                              styles.btnText,
                              isPinned && { color: "#FFFFFF" },
                            ]}
                          >
                            {isPinned ? "Unpin" : "Pin (Max 3)"}
                          </Text>
                        </>
                      )}
                    </Pressable>

                    <Pressable
                      style={[styles.btn, styles.toggleBtn]}
                      onPress={() => toggleStatus(item.id, item.status)}
                    >
                      <Text style={styles.btnText}>
                        {item.status === "published" ? "Hide" : "Publish"}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[styles.btn, styles.editBtn]}
                      onPress={() => router.push(`/admin/edit-course?id=${item.id}`)}
                    >
                      <Text style={styles.btnText}>Edit</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.btn, styles.deleteBtn]}
                      onPress={() => deleteCourse(item.id)}
                    >
                      <Ionicons name="trash-outline" size={15} color="#0F172A" />
                    </Pressable>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="book-outline" size={48} color="#64748B" />
                <Text style={styles.emptyText}>No courses found in this category.</Text>
              </View>
            }
          />
        )}
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
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  title: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "800",
  },
  subtitle: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 2,
  },
  catSelectorWrapper: {
    marginBottom: 12,
  },
  catScroll: {
    gap: 8,
    paddingBottom: 4,
  },
  catPill: {
    backgroundColor: "#131C31",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  catPillActive: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },
  catPillText: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
  },
  catPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  categoryPinBanner: {
    backgroundColor: "rgba(251, 191, 36, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.3)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  categoryPinTitle: {
    color: "#FBBF24",
    fontSize: 13,
    fontWeight: "700",
  },
  categoryPinDesc: {
    color: "#CBD5E1",
    fontSize: 12,
    marginTop: 3,
  },
  listContent: {
    paddingBottom: 40,
    gap: 10,
  },
  card: {
    backgroundColor: "#131C31",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  cardPinned: {
    borderColor: "#FBBF24",
    backgroundColor: "#172038",
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  pinnedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FBBF24",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pinnedBadgeText: {
    color: "#0F172A",
    fontSize: 9,
    fontWeight: "800",
  },
  cardMeta: {
    color: "#94A3B8",
    marginTop: 4,
    fontSize: 12,
  },
  rowBtns: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    alignItems: "center",
  },
  btn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },
  pinBtn: {
    backgroundColor: "#FBBF24",
  },
  unpinBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.8)",
  },
  toggleBtn: {
    backgroundColor: "#6366F1",
  },
  editBtn: {
    backgroundColor: "#E2E8F0",
  },
  deleteBtn: {
    backgroundColor: "#F87171",
    flex: 0.5,
  },
  btnText: {
    color: "#0F172A",
    fontWeight: "700",
    fontSize: 12,
  },
  centerLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "500",
  },
});
