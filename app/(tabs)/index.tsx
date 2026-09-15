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
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { coursesGroupedByCategory, listCategories, mySavedCourses, toggleSaveCourse } from "@/services/courses";
import { listNotificationsFor, subscribeNotifications } from "@/services/notifications";
import { Category, Course } from "@/types";
import { collection, query, orderBy, limit, getDocs, where, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { FadeInView } from "@/components/FadeInView";
import { CommunityPollCard } from "@/components/CommunityPollCard";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import { Poll, listenToActivePolls } from "@/services/polls";
import * as WebBrowser from "expo-web-browser";
import * as Clipboard from "@/utils/clipboard";
import { Linking } from "react-native";
import { 
  listenToCourseBoxConfig, 
  CourseBoxConfig, 
  defaultCourseBoxConfig 
} from "@/services/dashboardSettings";
import {
  listenToPlatformFeatures,
  PlatformFeatures,
} from "@/services/platformFeatures";
import { useNavBarVisibility } from "@/contexts/NavBarVisibilityContext";

type Group = { category: Category; courses: Course[] };

const CategoryCourseSlider = ({ courses, savedIds, handleToggleSave, colors, index = 0, boxConfig }: any) => {
  const listRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);

  useEffect(() => {
    if (!isAutoPlay || courses.length <= 1) return;
    
    let int: ReturnType<typeof setInterval>;
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
      renderItem={({ item, index: itemIdx }) => {
        const cardW = boxConfig?.cardWidth ?? 200;
        const imgH = boxConfig?.imageHeight ?? 100;
        const radius = boxConfig?.borderRadius ?? 16;
        const imgRadius = Math.max(radius - 4, 6);
        const titleSize = boxConfig?.titleFontSize ?? 14;
        const priceSize = boxConfig?.priceFontSize ?? 13;

        const content = (
          <>
            <View style={styles.cardImageContainer}>
              <CourseThumbnail
                uri={item.image}
                title={item.title}
                style={[styles.cardImage, { height: imgH, borderRadius: imgRadius }]}
                resizeMode="cover"
              />
              {item.isPinned ? (
                <View style={[styles.popularBadge, { backgroundColor: "rgba(251, 191, 36, 0.95)", borderColor: "#F59E0B" }]}>
                  <Text style={{ fontSize: 11 }}>📌</Text>
                  <Text style={[styles.popularBadgeText, { color: "#0F172A", fontWeight: "800" }]}>Pinned</Text>
                </View>
              ) : (
                <View style={styles.popularBadge}>
                  <Text style={{ fontSize: 12 }}>🔥</Text>
                  <Text style={styles.popularBadgeText}>Popular</Text>
                </View>
              )}
            </View>
            <Text 
              style={[styles.cardTitle, { color: colors.text, fontSize: titleSize }]} 
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <View style={styles.cardFooter}>
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                  <Ionicons name="star" size={12} color="#FBBF24" />
                  <Text style={[styles.ratingText, { color: colors.text }]}>
                    {" "}{(item.avgRating ?? 0) > 0 ? item.avgRating.toFixed(1) : "0.0"}{" "}
                    <Text style={{ color: colors.textDim }}>({item.ratingCount ?? 0})</Text>
                  </Text>
                </View>
                <Text 
                  style={[styles.priceText, { color: colors.text, fontSize: priceSize }]}
                >
                  GH₵{(item.price ?? 0).toFixed(2)}
                </Text>
              </View>
              <Pressable onPress={(e) => { e.stopPropagation(); handleToggleSave(item.id); }} style={{ padding: 4 }}>
                <Ionicons name={savedIds.has(item.id) ? "bookmark" : "bookmark-outline"} size={20} color={savedIds.has(item.id) ? colors.primary : colors.text} />
              </Pressable>
            </View>
          </>
        );

        return (
          <Pressable 
            style={[
              styles.card, 
              { 
                backgroundColor: colors.card,
                width: cardW,
                borderRadius: radius,
              }
            ]} 
            onPress={() => router.push(`/course/${item.id}`)}
          >
            {content}
          </Pressable>
        );
      }}
    />
  );
};

export default function Dashboard() {
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();
  const { isNavBarVisible, toggleNavBar, handleScroll } = useNavBarVisibility();
  const [groups, setGroups] = useState<Group[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [promo, setPromo] = useState<any>(null);
  const [showPromo, setShowPromo] = useState(false);
  const [activeBanner, setActiveBanner] = useState(0);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [boxConfig, setBoxConfig] = useState<CourseBoxConfig>(defaultCourseBoxConfig);
  const [features, setFeatures] = useState<PlatformFeatures>({
    enableGifting: true,
    enableChat: true,
  });
  const knownCourses = useRef<Set<string>>(new Set());

  // Listen to real-time course box sizing updates from Admin
  useEffect(() => {
    const unsub = listenToCourseBoxConfig((cfg) => {
      setBoxConfig(cfg);
    });
    const unsubFeatures = listenToPlatformFeatures(setFeatures);
    return () => {
      unsub();
      unsubFeatures();
    };
  }, []);

  const [broadcast, setBroadcast] = useState<any>(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const broadcastAnim = useRef(new Animated.Value(0.5)).current;
  const [unreadCount, setUnreadCount] = useState(0);

  const [activePoll, setActivePoll] = useState<Poll | null>(null);

  useEffect(() => {
    const unsub = listenToActivePolls((polls) => {
      setActivePoll(polls[0] || null);
    });
    return () => unsub();
  }, []);

  const banners = [
    {
      title: "Welcome back!",
      sub: "Pick up right where you left off.",
      img: require("../../assets/images/banner1.png"),
    },
    {
      title: "Top Picks",
      sub: "Explore courses recommended for you.",
      img: require("../../assets/images/banner2.png"),
    },
    {
      title: "New Releases",
      sub: "Stay ahead with the latest content.",
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

    // Check for broadcasts
    const bSnap = await getDocs(query(collection(db, "broadcasts"), orderBy("createdAt", "desc"), limit(1)));
    if (!bSnap.empty) {
      const b = { id: bSnap.docs[0].id, ...bSnap.docs[0].data() } as any;
      const seenId = await AsyncStorage.getItem("lastSeenBroadcastId");
      if (seenId !== b.id) {
        setBroadcast(b);
        setShowBroadcast(true);
        Animated.spring(broadcastAnim, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }).start();
      }
    }

    // Load unread count
    if (profile?.uid) {
      try {
        const allNotifs = await listNotificationsFor(profile.uid);
        const readSnap = await getDocs(query(collection(db, "notification_reads"), where("userId", "==", profile.uid)));
        const readIds = new Set(readSnap.docs.map(d => d.data().notificationId));
        const unread = allNotifs.filter(n => !readIds.has(n.id)).length;
        setUnreadCount(unread);
      } catch (e) {
        console.error("Failed to load unread count", e);
      }
    }
  }, [profile?.uid]);

  // Live real-time unread notifications count
  useEffect(() => {
    if (!profile?.uid) return;
    const unsub = subscribeNotifications(profile.uid, (notifs) => {
      const unread = notifs.filter((n) => !n.read).length;
      setUnreadCount(unread);
    });
    return () => unsub();
  }, [profile?.uid]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (categories.length === 0) return;
    // Bounded to the newest 300 published courses — an unbounded live
    // listener here re-downloads the entire catalog to every device on
    // every write and is the main cause of a sluggish home screen as
    // the catalog grows.
    const q = query(
      collection(db, "courses"),
      where("status", "==", "published"),
      where("reviewStatus", "==", "approved"),
      orderBy("createdAt", "desc"),
      limit(300)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (knownCourses.current.size > 0) {
        const added = snap.docChanges().filter(change => change.type === "added");
        added.forEach(change => {
          if (!knownCourses.current.has(change.doc.id)) {
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

  const getCategoryIcon = (name: string) => {
    if (!name) return "";
    const n = name.toLowerCase();
    if (n.includes("program") || n.includes("code") || n.includes("hack")) return "</> ";
    if (n.includes("tool") || n.includes("setup")) return "🔧 ";
    if (n.includes("tech") || n.includes("ai")) return "⚙️ ";
    if (n.includes("business") || n.includes("market") || n.includes("finance")) return "💼 ";
    if (n.includes("design") || n.includes("art")) return "🎨 ";
    if (n.includes("time") || n.includes("product")) return "⏱️ ";
    return "";
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
              Get <Text style={{fontWeight:"800", color:"#1F2937"}}>{promo.discountPercent}% OFF</Text> on this premium course! 
              Only {promo.maxClaims - promo.claims} claims left.
            </Text>
            <Pressable style={styles.promoBtn} onPress={() => { setShowPromo(false); router.push(`/course/${promo.courseId}?promo=${promo.id}&discount=${promo.discountPercent}`); }}>
              <Text style={styles.promoBtnText}>Claim Now</Text>
            </Pressable>
            <Pressable style={styles.promoCloseBtn} onPress={() => setShowPromo(false)}>
              <Text style={styles.promoCloseText}>Maybe Later</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Broadcast Popup */}
      <Modal visible={showBroadcast} transparent animationType="fade">
        <View style={styles.promoOverlay}>
          <Animated.View style={[styles.broadcastCard, { transform: [{ scale: broadcastAnim }] }]}>
            <View style={styles.broadcastIconWrapper}>
              <Ionicons name="megaphone" size={32} color="#6366F1" />
            </View>
            <Text style={styles.broadcastTitle}>{broadcast?.title}</Text>
            <ScrollView style={{ maxHeight: 200, marginVertical: 16 }}>
              <Text style={styles.broadcastMessage}>{broadcast?.message}</Text>
            </ScrollView>

            {/* Interactive Action Buttons (Link & Copy Text) */}
            {broadcast?.buttons && broadcast.buttons.length > 0 && (
              <View style={{ gap: 8, width: "100%", marginBottom: 12 }}>
                {broadcast.buttons.map((btn: any) => (
                  <Pressable
                    key={btn.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      backgroundColor: btn.type === "copy" ? "rgba(99, 102, 241, 0.15)" : "#6366F1",
                      borderWidth: btn.type === "copy" ? 1 : 0,
                      borderColor: "#6366F1",
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                    }}
                    onPress={async () => {
                      if (btn.type === "link") {
                        try {
                          await WebBrowser.openBrowserAsync(btn.value);
                        } catch {
                          Linking.openURL(btn.value).catch(() => {});
                        }
                      } else if (btn.type === "copy") {
                        await Clipboard.setStringAsync(btn.value);
                        Alert.alert("Copied to Clipboard! 🎉", `"${btn.value}" has been copied.`);
                      }
                    }}
                  >
                    <Ionicons
                      name={btn.type === "copy" ? "copy-outline" : "open-outline"}
                      size={17}
                      color={btn.type === "copy" ? "#818CF8" : "#FFFFFF"}
                    />
                    <Text
                      style={{
                        color: btn.type === "copy" ? "#818CF8" : "#FFFFFF",
                        fontWeight: "700",
                        fontSize: 14,
                      }}
                    >
                      {btn.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Pressable style={styles.broadcastBtn} onPress={async () => {
              setShowBroadcast(false);
              if (broadcast) await AsyncStorage.setItem("lastSeenBroadcastId", broadcast.id);
            }}>
              <Text style={styles.broadcastBtnText}>Got it</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
      <ScrollView
        style={{ flex: 1 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
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
            <Text style={[styles.brandTagline, { color: colors.textDim }]}>Learn • Grow • Build Your Future</Text>
          </View>
        </View>
        
        <View style={{ flex: 1 }} />
        
        <View style={styles.topBarRight}>
          <Pressable
            style={[
              styles.headerIconBtn,
              !isNavBarVisible && { backgroundColor: isDark ? "rgba(23, 105, 224, 0.25)" : "rgba(23, 105, 224, 0.12)" },
            ]}
            onPress={toggleNavBar}
            hitSlop={8}
          >
            <Ionicons
              name={isNavBarVisible ? "expand-outline" : "contract-outline"}
              size={20}
              color={!isNavBarVisible ? "#1769E0" : colors.text}
            />
          </Pressable>

          <Pressable style={styles.headerIconBtn} onPress={() => setShowSearch(!showSearch)}>
            <Ionicons name="search" size={22} color={colors.text} />
          </Pressable>
          {features.enableChat && (
            <Pressable style={styles.headerIconBtn} onPress={() => router.push("/chat")}>
              <Ionicons name="chatbubbles-outline" size={22} color={colors.text} />
            </Pressable>
          )}
          <Pressable style={styles.headerIconBtn} onPress={() => router.push("/notifications")}>
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            {unreadCount > 0 && (
              <View style={[styles.redDot, { borderColor: colors.background }]}>
                <Text style={styles.redDotText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Toggleable Search Bar */}
      {showSearch && (
        <View style={[styles.floatingSearchContainer, { marginTop: 0, marginBottom: 8, backgroundColor: colors.card, shadowColor: colors.shadow }]}>
          <Ionicons name="search" size={20} color={colors.textDim} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search for courses..."
            placeholderTextColor={colors.textDim}
            value={searchInput}
            onChangeText={setSearchInput}
            autoFocus
          />
          {searchInput.length > 0 && (
            <Pressable onPress={() => setSearchInput("")}>
              <Ionicons name="close-circle" size={20} color={colors.textDim} />
            </Pressable>
          )}
        </View>
      )}

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

      {/* Active Community Poll with countdown and live voting */}
      {activePoll && (
        <View style={{ marginTop: 20 }}>
          <CommunityPollCard poll={activePoll} />
        </View>
      )}

      {/* Category filter chips */}
      <View style={{ marginTop: 24, marginBottom: 8, paddingHorizontal: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>Browse by Category</Text>
        <Pressable onPress={() => {}}><Text style={{ color: colors.primary, fontWeight: "600" }}>See all ➔</Text></Pressable>
      </View>
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
                {getCategoryIcon(item.name)}{item.name}
              </Text>
            </Pressable>
          )}
        />

      {/* One horizontally-scrolling row per category or Grid if active */}
      {visibleGroups.map(({ category, courses }, idx) => (
        <View key={`group-view-${category.id ?? idx}`} style={{ marginTop: 24 }}>
          <View style={styles.rowHeader}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Popular in {category.name}</Text>
            </View>
            <Pressable onPress={() => setActiveCategory(activeCategory ? null : category.id)} style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>{activeCategory ? "Hide" : "See all ➔"}</Text>
            </Pressable>
          </View>
          
          <CategoryCourseSlider
            courses={courses}
            savedIds={savedIds}
            handleToggleSave={handleToggleSave}
            colors={colors}
            index={idx}
            boxConfig={boxConfig}
          />
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
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    marginBottom: 16,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  logoCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#312E81", alignItems: "center", justifyContent: "center",
  },
  logoText: { color: "#fff", fontWeight: "800", fontSize: 18 },
  brandName: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  brandTagline: { fontSize: 11, color: "#9CA3AF", marginTop: 0 },
  topBarRight: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 0 },
  balanceChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 4, paddingVertical: 4,
  },
  balanceChipText: { fontWeight: "700", fontSize: 13 },
  headerIconBtn: { padding: 4 },
  redDot: { position: "absolute", top: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: "#EF4444", borderWidth: 1, borderColor: "#F5F7FB", alignItems: "center", justifyContent: "center" },
  redDotText: { color: "#FFF", fontSize: 8, fontWeight: "bold" },
  
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

  chip: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#1E293B", borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  chipActive: { backgroundColor: "#4F46E5", borderColor: "#4F46E5" },
  chipText: { color: "#94A3B8", fontSize: 14, fontWeight: "600" },
  chipTextActive: { color: "#FFFFFF" },
  
  rowHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, marginBottom: 12,
  },
  rowTitle: { color: "#0F172A", fontSize: 18, fontWeight: "700" },
  seeAll: { color: "#4338CA", fontWeight: "600", fontSize: 13 },
  
  card: { 
    width: 200, backgroundColor: "#1E293B", borderRadius: 16, padding: 12, 
    borderWidth: 1, borderColor: "rgba(255,255,255,0.05)",
  },
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
  
  empty: { color: "#9CA3AF", textAlign: "center", marginTop: 60 },
  promoOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 100, justifyContent: "center", alignItems: "center", padding: 20 },
  promoCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 24, width: "100%", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  promoBadge: { backgroundColor: "#F3F4F6", color: "#1F2937", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, fontWeight: "700", fontSize: 11, marginBottom: 16 },
  promoTitle: { color: "#1F2937", fontSize: 22, fontWeight: "800", marginBottom: 8, textAlign: "center" },
  promoDesc: { color: "#4B5563", fontSize: 15, textAlign: "center", marginBottom: 24, lineHeight: 22 },
  promoBtn: { backgroundColor: "#1769E0", paddingVertical: 14, paddingHorizontal: 30, borderRadius: 12, width: "100%", alignItems: "center" },
  promoBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  promoCloseBtn: { marginTop: 16 },
  promoCloseText: { color: "#6B7280", fontWeight: "600" },
  
  broadcastCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 24, width: "90%", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  broadcastIconWrapper: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  broadcastTitle: { color: "#1F2937", fontSize: 20, fontWeight: "800", textAlign: "center" },
  broadcastMessage: { color: "#4B5563", fontSize: 15, lineHeight: 22, textAlign: "center" },
  broadcastBtn: { backgroundColor: "#1769E0", paddingVertical: 14, paddingHorizontal: 30, borderRadius: 12, width: "100%", alignItems: "center", marginTop: 8 },
  broadcastBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
