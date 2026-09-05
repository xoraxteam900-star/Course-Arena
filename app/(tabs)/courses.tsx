import { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, Pressable, TextInput, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { listCategories, listPublishedCourses } from "@/services/courses";
import { Category, Course } from "@/types";
import { useTheme } from "@/contexts/ThemeContext";
import { FadeInView } from "@/components/FadeInView";

export default function Courses() {
  const { colors } = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    listCategories().then(setCategories);
  }, []);

  useEffect(() => {
    listPublishedCourses({ categoryId: activeCategory ?? undefined, max: 100 }).then(setCourses);
  }, [activeCategory]);

  const filtered = courses.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <FadeInView style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>Search Courses</Text>
      <TextInput
        placeholder="Type course name to search..."
        placeholderTextColor={colors.textDim}
        style={[styles.search, { backgroundColor: colors.card, color: colors.text, shadowColor: colors.shadow }]}
        value={search}
        onChangeText={setSearch}
        autoFocus={true}
        returnKeyType="search"
      />

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ id: null, name: "All" } as any, ...categories]}
        keyExtractor={(c, index) => c.id ? `courses-cat-${c.id}` : `courses-cat-index-${index}`}
        style={{ flexGrow: 0, marginBottom: 16 }}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.chip, { backgroundColor: colors.card, shadowColor: colors.shadow }, activeCategory === item.id && { backgroundColor: colors.primary }]}
            onPress={() => setActiveCategory(item.id)}
          >
            <Text style={[styles.chipText, { color: colors.textDim }, activeCategory === item.id && { color: "#FFFFFF" }]}>{item.name}</Text>
          </Pressable>
        )}
      />

      <FlatList
        data={filtered}
        keyExtractor={(c, idx) => c.id ? `search-course-${c.id}` : `search-course-idx-${idx}`}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        renderItem={({ item }) => (
          <Pressable style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]} onPress={() => router.push(`/course/${item.id}`)}>
            {item.image ? <Image source={{ uri: item.image }} style={styles.thumb} /> : <View style={[styles.thumb, { backgroundColor: colors.border }]} />}
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
            <Text style={[styles.cardMeta, { color: colors.textDim }]}>GH₵{item.price.toFixed(2)}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={[styles.empty, { color: colors.textDim }]}>No courses match.</Text>}
      />
    </FadeInView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { color: "#0F172A", fontSize: 22, fontWeight: "800", marginBottom: 16, marginTop: 8 },
  search: { backgroundColor: "#FFFFFF", color: "#0F172A", borderRadius: 12, padding: 14, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#FFFFFF", borderRadius: 20, marginRight: 10, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  chipActive: { backgroundColor: "#4338B8" },
  chipText: { color: "#64748B", fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  card: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 14, padding: 10, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  thumb: { width: "100%", height: 90, borderRadius: 10, marginBottom: 8 },
  thumbPlaceholder: { backgroundColor: "#E2E8F0" },
  cardTitle: { color: "#0F172A", fontWeight: "700", fontSize: 13 },
  cardMeta: { color: "#64748B", marginTop: 4, fontSize: 12, fontWeight: "600" },
  empty: { color: "#94A3B8", textAlign: "center", marginTop: 40 },
});
