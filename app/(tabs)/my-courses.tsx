import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, Pressable, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { myPurchases, mySavedCourses, getCourse } from "@/services/courses";
import { Course } from "@/types";
import { FadeInView } from "@/components/FadeInView";

export default function MyCourses() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const [tab, setTab] = useState<"purchased" | "saved">("purchased");
  const [purchased, setPurchased] = useState<Course[]>([]);
  const [saved, setSaved] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [purchases, saves] = await Promise.all([
        myPurchases(profile.uid),
        mySavedCourses(profile.uid),
      ]);
      const pCourses = await Promise.all(purchases.map((p: any) => getCourse(p.courseId)));
      const sCourses = await Promise.all(saves.map((s: any) => getCourse(s.courseId)));
        
      // Deduplicate in case of bad data in Firebase
      const uniqueP = Array.from(new Map(pCourses.filter(Boolean).map(c => [c?.id, c])).values());
      const uniqueS = Array.from(new Map(sCourses.filter(Boolean).map(c => [c?.id, c])).values());
        
      setPurchased(uniqueP as Course[]);
      setSaved(uniqueS as Course[]);
    } catch (e) {
      console.error("My Courses load error:", e);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  const data = tab === "purchased" ? purchased : saved;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <FadeInView style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>My Courses</Text>
      <View style={styles.tabs}>
        <Pressable style={[styles.tabBtn, { backgroundColor: colors.card, shadowColor: colors.shadow }, tab === "purchased" && { backgroundColor: colors.primary }]} onPress={() => setTab("purchased")}>
          <Text style={[styles.tabText, { color: colors.textDim }, tab === "purchased" && { color: "#FFFFFF" }]}>Purchased ({purchased.length})</Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, { backgroundColor: colors.card, shadowColor: colors.shadow }, tab === "saved" && { backgroundColor: colors.primary }]} onPress={() => setTab("saved")}>
          <Text style={[styles.tabText, { color: colors.textDim }, tab === "saved" && { color: "#FFFFFF" }]}>Saved ({saved.length})</Text>
        </Pressable>
      </View>

      <FlatList
        data={data}
        keyExtractor={(c, idx) => c.id ?? `mc-${idx}`}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 20 }}
        contentContainerStyle={{ paddingBottom: 100, gap: 16 }}
        onRefresh={load}
        refreshing={loading}
        renderItem={({ item }) => (
          <Pressable style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]} onPress={() => router.push(`/course/${item.id}`)}>
            <View style={styles.cardImageContainer}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.cardImage} />
              ) : (
                <View style={[styles.cardImage, { backgroundColor: colors.border }]} />
              )}
            </View>
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textDim }]}>
            {tab === "purchased" ? "You haven't purchased any courses yet." : "You haven't saved any courses yet."}
          </Text>
        }
      />
    </FadeInView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 16, marginTop: 8, paddingHorizontal: 20 },
  tabs: { flexDirection: "row", gap: 10, marginBottom: 16, paddingHorizontal: 20 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tabText: { fontWeight: "600" },
  card: { flex: 1, borderRadius: 14, padding: 10, shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardImageContainer: { position: "relative", marginBottom: 8 },
  cardImage: { width: "100%", height: 90, borderRadius: 10 },
  cardTitle: { fontWeight: "700", fontSize: 13, lineHeight: 18 },
  empty: { textAlign: "center", marginTop: 40, paddingHorizontal: 20 },
});
