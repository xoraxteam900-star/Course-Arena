import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Image,
  RefreshControl,
  ScrollView,
  TextInput,
  Animated,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { coursesGroupedByCategory, listCategories, mySavedCourses, toggleSaveCourse } from "@/services/courses";
import { Category, Course } from "@/types";
import { collection, query, orderBy, limit, getDocs, where, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { FadeInView } from "@/components/FadeInView";

type Group = { category: Category; courses: Course[] };

const CategoryCourseSlider = ({ courses, savedIds, handleToggleSave, colors, index = 0 }: any) => {
  const listRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);

  useEffect(() => {
    if (!isAutoPlay || courses.length <= 1) return;
    
    let int: NodeJS.Timeout;
    const timeout = setTimeout(() => {
      int = setInterval(() => {
        setCurrentIndex((prev) => {
          const nextIndex = (prev + 1) % courses.length;
          try {
            listRef.current?.scrollToIndex({ index: nextIndex, animated: true, viewPosition: 0.5 });
          } catch (e) {
            // Ignore scroll errors if layout is not ready
          }
          return nextIndex;
        });
      }, 4000);
    }, index * 1500); // 1.5s delay between each category's movement

    return () => {
      clearTimeout(timeout);
      if (int) clearInterval(int);
    };
  }, [isAutoPlay, courses.length, index]);

  return (
    <FlatList
      ref={listRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      data={courses}
      initialNumToRender={3}
      maxToRenderPerBatch={3}
      windowSize={5}
      keyExtractor={(c: any, idx: number) => c.id ? `card-${c.id}` : `course-${idx}`}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 16 }}
      onScrollBeginDrag={() => setIsAutoPlay(false)}
      onScrollToIndexFailed={(info) => {
        setTimeout(() => {
          listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
        }, 100);
      }}
      renderItem={({ item }) => (
        <Pressable style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]} onPress={() => router.push(`/course/${item.id}`)}>
          <View style={styles.cardImageContainer}>
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.cardImage} />
            ) : (
              <View style={[styles.cardImage, { backgroundColor: colors.border }]} />
            )}
            <View style={styles.popularBadge}>
              <Text style={{ fontSize: 12 }}>🔥</Text>
              <Text style={styles.popularBadgeText}>Popular</Text>
            </View>
          </View>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
          <View style={styles.cardFooter}>
            <View>
              {item.avgRating ? (
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                  <Ionicons name="star" size={12} color="#FBBF24" />
                  <Text style={[styles.ratingText, { color: colors.text }]}>
                    {" "}{item.avgRating.toFixed(1)} <Text style={{ color: colors.textDim }}>({item.ratingCount})</Text>
                  </Text>
                </View>
              ) : null}
              <Text style={[styles.priceText, { color: colors.text }]}>GH₵{(item.price ?? 0).toFixed(2)}</Text>
            </View>
            <Pressable onPress={(e) => { e.stopPropagation(); handleToggleSave(item.id); }} style={{ padding: 4 }}>
              <Ionicons name={savedIds.has(item.id) ? "bookmark" : "bookmark-outline"} size={20} color={savedIds.has(item.id) ? colors.primary : colors.text} />
            </Pressable>
          </View>
        </Pressable>
      )}
    />
  );
};

export default function Dashboard() {
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();
  const [groups, setGroups] = useState<Group[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [promo, setPromo] = useState<any>(null);
  const [showPromo, setShowPromo] = useState(false);
  const [activeBanner, setActiveBanner] = useState(0);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const knownCourses = useRef<Set<string>>(new Set());

  const banners = [
    {
      title: "Grow Your Skills",
      sub: "Access thousands of courses\nfrom top creators.",
      img: require("../../assets/images/banner1.png"),
    },
    {
      title: "Tech Mastery",
      sub: "Unlock your potential with\ncutting-edge modules.",
      img: require("../../assets/images/banner2.png"),
    },
    {
      title: "Launch Career",
      sub: "Fast-track your journey\nand reach for the stars.",
      img: require("../../assets/images/banner3.png"),
    },
  ];

  useEffect(() => {
    const int = setInterval(() => {
      setActiveBanner((prev) => (prev + 1) % banners.length);
    }, 3000);
    return () => clearInterval(int);
  }, []);

  const load = useCallback(async () => {
    const c = await listCategories();
    setCategories(c);

    if (profile) {
      const saved = await mySavedCourses(profile.uid);
      setSavedIds(new Set(saved.map((s: any) => s.courseId)));
    }
    
    // Check for active promos
    const promoSnap = await getDocs(query(collection(db, "promos"), orderBy("createdAt", "desc"), limit(1)));
    if (!promoSnap.empty) {
      const p = { id: promoSnap.docs[0].id, ...promoSnap.docs[0].data() } as any;
      const hoursPassed = (Date.now() - (p.createdAt?.toMillis?.() || Date.now())) / 3600000;
      if (hoursPassed < p.hoursValid && p.claims < p.maxClaims) {
        setPromo(p);
        setShowPromo(true);
      }
    }
  }, [profile?.uid]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (categories.length === 0) return;
    const q = query(
      collection(db, "courses"),
      where("status", "==", "published"),
      where("reviewStatus", "==", "approved"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      if (knownCourses.current.size > 0) {
        const added = snap.docChanges().filter(change => change.type === "added");
        added.forEach(change => {
          if (!knownCourses.current.has(change.doc.id)) {
            const newCourse = change.doc.data() as Course;
            Alert.alert("New Course Dropped! 🎉", `"${newCourse.title}" is now available in the arena!`, [
              { text: "Dismiss", style: "cancel" },
              { text: "View Course", onPress: () => router.push(`/course/${change.doc.id}`) }
            ]);
            knownCourses.current.add(change.doc.id);
          }
        });
      }
      
      snap.docs.forEach(d => knownCourses.current.add(d.id));

      const allCourses = snap.docs.map(d => ({ id: d.id, ...d.data() } as Course));
      const newGroups = categories.map(cat => ({
        category: cat,
        courses: allCourses.filter(c => c.categoryId === cat.id).slice(0, 6)
      })).filter(g => g.courses.length > 0);
      setGroups(newGroups);
    });
    return () => unsub();
  }, [categories]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  const visibleGroups = React.useMemo(() => {
    let filtered = groups;
    if (activeCategory) {
      filtered = filtered.filter((g) => g.category.id === activeCategory);
    }
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      filtered = filtered.map(g => ({
        category: g.category,
        courses: g.courses.filter(c => c.title.toLowerCase().includes(q))
      })).filter(g => g.courses.length > 0);
    }
    return filtered;
  }, [groups, activeCategory, searchQuery]);

  const handleToggleSave = async (courseId: string) => {
    if (!profile) {
      router.push("/(auth)/login");
      return;
    }
    const isSaved = savedIds.has(courseId);
    const newSaved = new Set(savedIds);
    if (isSaved) newSaved.delete(courseId);
    else newSaved.add(courseId);
    setSavedIds(newSaved);

    try {
      await toggleSaveCourse(profile.uid, courseId);
    } catch (e) {
      console.error("Failed to toggle save", e);
      setSavedIds(savedIds); // Revert
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <FadeInView>
      {promo && showPromo && (
        <View style={styles.promoOverlay}>
          <View style={styles.promoCard}>
            <Text style={styles.promoBadge}>LIMITED TIME OFFER</Text>
            <Text style={styles.promoTitle}>Special Discount!</Text>
            <Text style={styles.promoDesc}>
              Get <Text style={{fontWeight:"800", color:"#fff"}}>{promo.discountPercent}% OFF</Text> on this premium course! 
              Only {promo.maxClaims - promo.claims} claims left.
            </Text>
            <Pressable style={styles.promoBtn} onPress={() => { setShowPromo(false); router.push(`/course/${promo.courseId}?promo=${promo.discountPercent}`); }}>
              <Text style={styles.promoBtnText}>Claim Now</Text>
            </Pressable>
            <Pressable style={styles.promoCloseBtn} onPress={() => setShowPromo(false)}>
              <Text style={styles.promoCloseText}>Maybe Later</Text>
            </Pressable>
          </View>
        </View>
      )}
      <ScrollView
        style={{ flex: 1 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >


      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={[styles.logoCircle, { backgroundColor: colors.card, overflow: "hidden" }]}>
            <Image source={require("../../assets/images/logo.png")} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
          </View>
          <View>
            <Text style={[styles.brandName, { color: colors.text }]}>Course Arena</Text>
            <Text style={[styles.brandTagline, { color: colors.textDim }]}>Learn Today, Build Tomorrow</Text>
          </View>
        </View>
        <View style={styles.topBarRight}>
          <Pressable style={styles.balanceChip} onPress={() => router.push("/(tabs)/wallet")}>
            <Ionicons name="wallet-outline" size={16} color="#92400E" />
            <Text style={styles.balanceChipText}>GH₵{(profile?.balance ?? 0).toFixed(2)}</Text>
          </Pressable>
          <Pressable style={styles.bellBtn} onPress={() => router.push("/notifications")}>
            <Ionicons name="notifications-outline" size={24} color={colors.text} />
            <View style={[styles.redDot, { borderColor: colors.background }]} />
          </Pressable>
        </View>
      </View>

      {/* Promotional Banner Slider */}
      <View style={styles.bannerContainer}>
        <View style={styles.bannerContent}>
          <Text style={styles.bannerTitle}>{banners[activeBanner].title}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingRight: 40 }}>
            <Text style={styles.bannerSub}>{banners[activeBanner].sub}</Text>
            <Pressable style={styles.exploreBtn} onPress={() => router.push("/(tabs)/courses")}>
              <Text style={styles.exploreBtnText}>Explore</Text>
              <Ionicons name="arrow-forward" size={12} color="#0F172A" />
            </Pressable>
          </View>
        </View>
        
        <Image source={banners[activeBanner].img} style={styles.bannerGraphic} resizeMode="contain" />
        
        <View style={styles.bannerDots}>
          {banners.map((_, i) => (
            <View key={i} style={[styles.dot, activeBanner === i && styles.dotActive]} />
          ))}
        </View>
      </View>

      {/* Permanent Search Bar (Android Only) */}
      {Platform.OS === 'android' && (
        <View style={[styles.floatingSearchContainer, { marginTop: 16, marginBottom: 8, backgroundColor: colors.card, shadowColor: colors.shadow }]}>
          <Ionicons name="search" size={20} color={colors.textDim} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search for courses..."
            placeholderTextColor={colors.textDim}
            value={searchInput}
            onChangeText={setSearchInput}
          />
          {searchInput.length > 0 && (
            <Pressable onPress={() => setSearchInput("")}>
              <Ionicons name="close-circle" size={20} color={colors.textDim} />
            </Pressable>
          )}
        </View>
      )}

      {/* Category filter chips */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ id: null, name: "All" } as any, ...categories]}
        keyExtractor={(c, index) => c.id ? `chip-${c.id}` : `cat-${index}`}
        style={{ flexGrow: 0, marginTop: 16, marginBottom: 8 }}
        contentContainerStyle={{ paddingHorizontal: 20 }}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.chip, { backgroundColor: colors.card, shadowColor: colors.shadow }, activeCategory === item.id && { backgroundColor: colors.primary }]}
            onPress={() => setActiveCategory(item.id)}
          >
            <Text style={[styles.chipText, { color: colors.textDim }, activeCategory === item.id && { color: colors.primaryText }]}>
              {item.name}
            </Text>
          </Pressable>
        )}
      />

      {/* One horizontally-scrolling row per category or Grid if active */}
      {visibleGroups.map(({ category, courses }, idx) => (
        <View key={`group-view-${category.id ?? idx}`} style={{ marginTop: 24 }}>
          <View style={styles.rowHeader}>
            <View>
              <Text style={[styles.rowEyebrow, { color: colors.textDim }]}>Category</Text>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{category.name}</Text>
            </View>
            {!activeCategory && (
              <Pressable onPress={() => setActiveCategory(category.id)} style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.primary} style={{ marginLeft: 4 }} />
              </Pressable>
            )}
          </View>
          
          {activeCategory ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", paddingHorizontal: 20 }}>
              {courses.map((item, i) => (
                <Pressable 
                  key={`grid-card-${item.id ?? i}`} 
                  style={[styles.card, { width: '48%', backgroundColor: colors.card, shadowColor: colors.shadow, marginBottom: 16 }]} 
                  onPress={() => router.push(`/course/${item.id}`)}>
                  <View style={styles.cardImageContainer}>
                    {item.image ? (
                      <Image source={{ uri: item.image }} style={styles.cardImage} />
                    ) : (
                      <View style={[styles.cardImage, { backgroundColor: colors.border }]} />
                    )}
                    <View style={styles.popularBadge}>
                      <Text style={{ fontSize: 12 }}>🔥</Text>
                      <Text style={styles.popularBadgeText}>Popular</Text>
                    </View>
                  </View>
                  <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                  <View style={styles.cardFooter}>
                    <View>
                      {item.avgRating ? (
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                          <Ionicons name="star" size={12} color="#FBBF24" />
                          <Text style={[styles.ratingText, { color: colors.text }]}>
                            {" "}{item.avgRating.toFixed(1)} <Text style={{ color: colors.textDim }}>({item.ratingCount})</Text>
                          </Text>
                        </View>
                      ) : null}
                      <Text style={[styles.priceText, { color: colors.text }]}>GH₵{(item.price ?? 0).toFixed(2)}</Text>
                    </View>
                    <Pressable onPress={(e) => { e.stopPropagation(); handleToggleSave(item.id); }} style={{ padding: 4 }}>
                      <Ionicons name={savedIds.has(item.id) ? "bookmark" : "bookmark-outline"} size={20} color={savedIds.has(item.id) ? colors.primary : colors.text} />
                    </Pressable>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <CategoryCourseSlider
              courses={courses}
              savedIds={savedIds}
              handleToggleSave={handleToggleSave}
              colors={colors}
              index={idx}
            />
          )}
        </View>
      ))}

      {visibleGroups.length === 0 && (
        <Text style={styles.empty}>No courses yet — check back soon.</Text>
      )}
      <View style={{ height: 120 }} />
      </ScrollView>
      </FadeInView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FB" },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 40 : 16,
    marginBottom: 16,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  logoCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#312E81", alignItems: "center", justifyContent: "center",
  },
  logoText: { color: "#fff", fontWeight: "800", fontSize: 18 },
  brandName: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  brandTagline: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  topBarRight: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 0 },
  balanceChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FEF3C7", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
  },
  balanceChipText: { color: "#92400E", fontWeight: "700", fontSize: 13 },
  bellBtn: { position: "relative", padding: 8, marginRight: -8 }, // Negative margin offsets padding so visual alignment is kept while touch target is bigger
  redDot: { position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444", borderWidth: 1, borderColor: "#F5F7FB" },
  
  bannerContainer: {
    backgroundColor: "#1E1B4B",
    marginHorizontal: 20,
    borderRadius: 14,
    padding: 16,
    paddingBottom: 24, // extra space for dots
    position: "relative",
    overflow: "hidden",
  },
  bannerContent: { zIndex: 2 },
  bannerTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "800", marginBottom: 6 },
  bannerSub: { color: "#94A3B8", fontSize: 10, lineHeight: 14, marginRight: 10 },
  exploreBtn: { backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 4 },
  exploreBtnText: { color: "#0F172A", fontWeight: "700", fontSize: 11 },
  bannerGraphic: { position: "absolute", right: -20, bottom: -10, width: 120, height: 120, opacity: 0.9, zIndex: 1 },
  bannerDots: { position: "absolute", bottom: 8, right: 16, flexDirection: "row", gap: 6, zIndex: 3 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.3)" },
  dotActive: { backgroundColor: "#FFFFFF" },

  floatingSearchContainer: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#FFFFFF", marginHorizontal: 20, marginTop: 16, marginBottom: 8,
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  searchInput: { flex: 1, color: "#0F172A", fontSize: 16, paddingVertical: 0 },

  chip: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: "#FFFFFF", borderRadius: 20, marginRight: 10 },
  chipActive: { backgroundColor: "#312E81" },
  chipText: { color: "#64748B", fontSize: 14, fontWeight: "600" },
  chipTextActive: { color: "#FFFFFF" },
  
  rowHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, marginBottom: 16,
  },
  rowEyebrow: { color: "#64748B", fontSize: 13, marginBottom: 2 },
  rowTitle: { color: "#0F172A", fontSize: 24, fontWeight: "800" },
  seeAll: { color: "#4338CA", fontWeight: "700", fontSize: 15 },
  
  card: { width: 170, backgroundColor: "#FFFFFF", borderRadius: 16, padding: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardImageContainer: { position: "relative", marginBottom: 8 },
  cardImage: { width: "100%", height: 100, borderRadius: 10 },
  cardImagePlaceholder: { backgroundColor: "#E2E8F0" },
  popularBadge: { position: "absolute", bottom: 8, left: 8, backgroundColor: "rgba(0,0,0,0.7)", flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, gap: 4 },
  popularBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "600" },
  cardTitle: { color: "#0F172A", fontWeight: "700", fontSize: 14, marginBottom: 6, paddingHorizontal: 4 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: 4 },
  ratingText: { color: "#1F2937", fontWeight: "700", fontSize: 11 },
  ratingCount: { color: "#9CA3AF", fontWeight: "400" },
  priceText: { color: "#0F172A", fontWeight: "800", fontSize: 13 },
  
  empty: { color: "#94A3B8", textAlign: "center", marginTop: 60 },
  promoOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)", zIndex: 100, justifyContent: "center", alignItems: "center", padding: 20 },
  promoCard: { backgroundColor: "#EC4899", borderRadius: 24, padding: 30, width: "100%", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  promoBadge: { backgroundColor: "#fff", color: "#EC4899", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, fontWeight: "800", fontSize: 12, marginBottom: 16 },
  promoTitle: { color: "#fff", fontSize: 26, fontWeight: "800", marginBottom: 12, textAlign: "center" },
  promoDesc: { color: "#FDF2F8", fontSize: 16, textAlign: "center", marginBottom: 24, lineHeight: 24 },
  promoBtn: { backgroundColor: "#fff", paddingVertical: 14, paddingHorizontal: 30, borderRadius: 16, width: "100%", alignItems: "center" },
  promoBtnText: { color: "#EC4899", fontSize: 16, fontWeight: "800" },
  promoCloseBtn: { marginTop: 16 },
  promoCloseText: { color: "#FDF2F8", fontWeight: "600" },
});
