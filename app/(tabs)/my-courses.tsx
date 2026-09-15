import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Image,
  TextInput,
  ActivityIndicator,
  Modal,
  Share,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { myPurchases, mySavedCourses, getCourse, listCategories, toggleSaveCourse } from "@/services/courses";
import { getMyAccessLink } from "@/services/wallet";
import { Course, Category } from "@/types";
import { FadeInView } from "@/components/FadeInView";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import { useNavBarVisibility } from "@/contexts/NavBarVisibilityContext";

// Helper to assign icons to categories matching the design
function getCategoryIcon(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("hack") || lower.includes("sec") || lower.includes("cyber")) return "🛡️";
  if (lower.includes("tool") || lower.includes("util")) return "🔧";
  if (lower.includes("edit") || lower.includes("design") || lower.includes("graphic") || lower.includes("photo") || lower.includes("video")) return "🖼️";
  if (lower.includes("ai") || lower.includes("intel") || lower.includes("bot") || lower.includes("machine")) return "🤖";
  if (lower.includes("dev") || lower.includes("code") || lower.includes("program") || lower.includes("web")) return "💻";
  if (lower.includes("mobile") || lower.includes("app") || lower.includes("android") || lower.includes("ios")) return "📱";
  if (lower.includes("biz") || lower.includes("market") || lower.includes("sales") || lower.includes("seo")) return "📈";
  if (lower.includes("crypto") || lower.includes("coin") || lower.includes("money") || lower.includes("finance")) return "🪙";
  return "🎓";
}

type SortOption = "recent" | "title" | "rating";

export default function MyCourses() {
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();
  const { isNavBarVisible, toggleNavBar, handleScroll } = useNavBarVisibility();

  const [tab, setTab] = useState<"purchased" | "saved">("purchased");
  const [purchased, setPurchased] = useState<Course[]>([]);
  const [saved, setSaved] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Search & Sorting state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [showSortModal, setShowSortModal] = useState(false);

  // Action sheet / options modal state
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [openingCourseId, setOpeningCourseId] = useState<string | null>(null);

  // Load all user courses & categories
  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [purchases, saves, cats] = await Promise.all([
        myPurchases(profile.uid),
        mySavedCourses(profile.uid),
        listCategories(),
      ]);

      const pCourses = await Promise.all(purchases.map((p: any) => getCourse(p.courseId)));
      const sCourses = await Promise.all(saves.map((s: any) => getCourse(s.courseId)));

      // Deduplicate in case of bad data
      const uniqueP = Array.from(new Map(pCourses.filter(Boolean).map((c) => [c?.id, c])).values()) as Course[];
      const uniqueS = Array.from(new Map(sCourses.filter(Boolean).map((c) => [c?.id, c])).values()) as Course[];

      setPurchased(uniqueP);
      setSaved(uniqueS);
      setCategories(cats);
    } catch (e) {
      console.error("My Courses load error:", e);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  // Fast check if course is in saved list
  const savedIds = useMemo(() => new Set(saved.map((s) => s.id)), [saved]);

  // Handle direct "Continue / Open"
  async function handleOpenCourse(course: Course) {
    setOpeningCourseId(course.id);
    try {
      const link = await getMyAccessLink(course.id);
      if (link) {
        router.push({
          pathname: "/course/viewer",
          params: { url: encodeURIComponent(link) },
        });
      } else {
        router.push(`/course/${course.id}`);
      }
    } catch {
      router.push(`/course/${course.id}`);
    } finally {
      setOpeningCourseId(null);
    }
  }

  // Handle Save / Bookmark toggle
  async function handleToggleSave(course: Course) {
    if (!profile) return;
    try {
      const isNowSaved = await toggleSaveCourse(profile.uid, course.id);
      if (isNowSaved) {
        setSaved((prev) => [...prev.filter((s) => s.id !== course.id), course]);
      } else {
        setSaved((prev) => prev.filter((s) => s.id !== course.id));
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update saved course");
    }
  }

  // Share course
  async function handleShareCourse(course: Course) {
    try {
      await Share.share({
        title: course.title,
        message: `Check out "${course.title}" on CourseArena!`,
      });
    } catch {
      // Ignored
    }
  }

  // Primary active list
  const activeList = tab === "purchased" ? purchased : saved;

  // Filter and sort
  const filteredAndSortedList = useMemo(() => {
    let list = [...activeList];

    // Category filter
    if (selectedCategory) {
      list = list.filter((c) => c.categoryId === selectedCategory);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((c) => c.title.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q));
    }

    // Sort
    if (sortBy === "title") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "rating") {
      list.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0));
    }
    // "recent" preserves default fetch order (most recent purchases/saves)

    return list;
  }, [activeList, selectedCategory, searchQuery, sortBy]);

  // Continue Learning list (Top 2 recent purchased courses)
  const continueList = useMemo(() => {
    return purchased.slice(0, 2);
  }, [purchased]);

  // Color tokens
  const bg = isDark ? "#070B14" : colors.background;
  const cardBg = isDark ? "#0E1626" : colors.card;
  const cardBorder = isDark ? "rgba(255, 255, 255, 0.07)" : "#E2E8F0";
  const textColor = isDark ? "#FFFFFF" : "#0F172A";
  const textDimColor = isDark ? "#94A3B8" : "#64748B";
  const purplePrimary = "#5B4DFF";

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bg }]}>
      <FadeInView style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable
              style={styles.backBtn}
              onPress={() => router.back()}
              hitSlop={10}
            >
              <Ionicons name="chevron-back" size={24} color={textColor} />
            </Pressable>
            <View>
              <Text style={[styles.headerTitle, { color: textColor }]}>My Courses</Text>
              <Text style={[styles.headerSubtitle, { color: textDimColor }]}>
                Keep learning, keep growing 💜
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <Pressable
              style={[
                styles.iconCircleBtn,
                { backgroundColor: !isNavBarVisible ? "rgba(91, 77, 255, 0.2)" : isDark ? "rgba(255,255,255,0.06)" : "#EEF2F6" },
              ]}
              onPress={toggleNavBar}
              hitSlop={8}
            >
              <Ionicons
                name={isNavBarVisible ? "expand-outline" : "contract-outline"}
                size={19}
                color={!isNavBarVisible ? "#5B4DFF" : textColor}
              />
            </Pressable>

            <Pressable
              style={[styles.iconCircleBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#EEF2F6" }]}
              onPress={() => setIsSearching((prev) => !prev)}
              hitSlop={8}
            >
              <Ionicons name="search" size={19} color={textColor} />
            </Pressable>
            <Pressable
              style={[styles.iconCircleBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#EEF2F6" }]}
              onPress={() => setShowSortModal(true)}
              hitSlop={8}
            >
              <Ionicons name="ellipsis-vertical" size={19} color={textColor} />
            </Pressable>
          </View>
        </View>

        {/* INLINE SEARCH BAR (Toggled via search icon) */}
        {isSearching && (
          <View style={[styles.searchBarContainer, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Ionicons name="search-outline" size={18} color={textDimColor} />
            <TextInput
              style={[styles.searchInput, { color: textColor }]}
              placeholder="Search your courses..."
              placeholderTextColor={textDimColor}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={textDimColor} />
              </Pressable>
            )}
          </View>
        )}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* SEGMENTED TABS: PURCHASED vs SAVED */}
          <View style={[styles.tabContainer, { backgroundColor: isDark ? "#0A101D" : "#EEF2F6" }]}>
            <Pressable
              style={[
                styles.tabButton,
                tab === "purchased" && [styles.tabButtonActive, { backgroundColor: purplePrimary }],
              ]}
              onPress={() => {
                setTab("purchased");
                setSelectedCategory(null);
              }}
            >
              <Ionicons
                name="bag-handle-outline"
                size={16}
                color={tab === "purchased" ? "#FFFFFF" : textDimColor}
              />
              <Text
                style={[
                  styles.tabButtonText,
                  { color: tab === "purchased" ? "#FFFFFF" : textDimColor },
                ]}
              >
                Purchased ({purchased.length})
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.tabButton,
                tab === "saved" && [styles.tabButtonActive, { backgroundColor: purplePrimary }],
              ]}
              onPress={() => {
                setTab("saved");
                setSelectedCategory(null);
              }}
            >
              <Ionicons
                name="bookmark-outline"
                size={16}
                color={tab === "saved" ? "#FFFFFF" : textDimColor}
              />
              <Text
                style={[
                  styles.tabButtonText,
                  { color: tab === "saved" ? "#FFFFFF" : textDimColor },
                ]}
              >
                Saved ({saved.length})
              </Text>
            </Pressable>
          </View>

          {/* STAT / JOURNEY BANNER (WITHOUT PROGRESS, AS REQUESTED) */}
          <View style={[styles.journeyBanner, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.journeyLeft}>
              <View style={styles.journeyIconCircle}>
                <Ionicons name="school" size={24} color="#818CF8" />
              </View>
              <View>
                <Text style={[styles.journeyCount, { color: textColor }]}>
                  {tab === "purchased" ? `${purchased.length} Courses` : `${saved.length} Saved`}
                </Text>
                <Text style={[styles.journeySubtitle, { color: textDimColor }]}>
                  Your learning journey continues!
                </Text>
              </View>
            </View>

            {/* Clean badge indicator without progress percentages */}
            <View style={styles.journeyRight}>
              <View style={styles.badgePill}>
                <Ionicons name="sparkles" size={13} color="#A5B4FC" />
                <Text style={styles.badgePillText}>
                  {tab === "purchased" ? "Lifetime Access" : "Ready to Enroll"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={textDimColor} />
            </View>
          </View>

          {/* CONTINUE LEARNING SECTION (Shown when purchased tab is active & courses exist) */}
          {tab === "purchased" && continueList.length > 0 && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: textColor }]}>Continue Learning</Text>
                <Pressable
                  onPress={() => {
                    // Scroll down to all courses
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.seeAllText}>See all ➔</Text>
                </Pressable>
              </View>

              <View style={styles.continueList}>
                {continueList.map((course) => (
                  <Pressable
                    key={`cont-${course.id}`}
                    style={[styles.continueCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
                    onPress={() => router.push(`/course/${course.id}`)}
                  >
                    {/* Course Thumbnail */}
                    <View style={styles.continueThumbWrapper}>
                      <CourseThumbnail
                        uri={course.image}
                        title={course.title}
                        style={styles.continueThumb}
                        resizeMode="cover"
                      />
                    </View>

                    {/* Course Info & Actions (NO PROGRESS BAR AS REQUESTED) */}
                    <View style={styles.continueDetails}>
                      <Text style={[styles.continueTitle, { color: textColor }]} numberOfLines={1}>
                        {course.title}
                      </Text>
                      <Text style={[styles.continueMeta, { color: textDimColor }]} numberOfLines={1}>
                        {course.categoryId
                          ? categories.find((c) => c.id === course.categoryId)?.name || "Ready to watch"
                          : "Ready to watch"}
                      </Text>

                      <View style={styles.continueActionRow}>
                        <Pressable
                          style={[styles.continueBtn, { backgroundColor: purplePrimary }]}
                          onPress={() => handleOpenCourse(course)}
                          disabled={openingCourseId === course.id}
                        >
                          {openingCourseId === course.id ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Ionicons name="play" size={13} color="#FFFFFF" />
                              <Text style={styles.continueBtnText}>Continue</Text>
                            </>
                          )}
                        </Pressable>

                        <Pressable
                          onPress={() => {
                            setSelectedCourse(course);
                            setShowOptionsModal(true);
                          }}
                          hitSlop={8}
                          style={styles.moreBtn}
                        >
                          <Ionicons name="ellipsis-vertical" size={18} color={textDimColor} />
                        </Pressable>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* ALL COURSES SECTION */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>
                {tab === "purchased" ? "All Purchased Courses" : "All Saved Courses"}
              </Text>
              <Pressable
                style={[styles.sortPill, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#EEF2F6" }]}
                onPress={() => setShowSortModal(true)}
                hitSlop={8}
              >
                <Ionicons name="swap-vertical" size={14} color={textColor} />
                <Text style={[styles.sortPillText, { color: textColor }]}>
                  {sortBy === "recent" ? "Recent" : sortBy === "title" ? "A - Z" : "Rating"}
                </Text>
                <Ionicons name="chevron-down" size={12} color={textDimColor} />
              </Pressable>
            </View>

            {/* HORIZONTAL CATEGORY FILTER PILLS */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              <Pressable
                style={[
                  styles.categoryPill,
                  { backgroundColor: selectedCategory === null ? purplePrimary : isDark ? "#0E1626" : "#EEF2F6" },
                  selectedCategory !== null && { borderWidth: 1, borderColor: cardBorder },
                ]}
                onPress={() => setSelectedCategory(null)}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    { color: selectedCategory === null ? "#FFFFFF" : textDimColor },
                    selectedCategory === null && { fontWeight: "700" },
                  ]}
                >
                  All ({activeList.length})
                </Text>
              </Pressable>

              {categories.map((cat) => {
                const count = activeList.filter((c) => c.categoryId === cat.id).length;
                const isSelected = selectedCategory === cat.id;
                const icon = getCategoryIcon(cat.name);

                return (
                  <Pressable
                    key={`cat-${cat.id}`}
                    style={[
                      styles.categoryPill,
                      { backgroundColor: isSelected ? purplePrimary : isDark ? "#0E1626" : "#EEF2F6" },
                      !isSelected && { borderWidth: 1, borderColor: cardBorder },
                    ]}
                    onPress={() => setSelectedCategory(isSelected ? null : cat.id)}
                  >
                    <Text style={styles.categoryEmoji}>{icon}</Text>
                    <Text
                      style={[
                        styles.categoryPillText,
                        { color: isSelected ? "#FFFFFF" : textDimColor },
                        isSelected && { fontWeight: "700" },
                      ]}
                    >
                      {cat.name}
                      {count > 0 ? ` (${count})` : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* COURSE GRID (2 COLUMNS) - NO PROGRESS BARS AS REQUESTED */}
            {loading ? (
              <View style={styles.loadingWrapper}>
                <ActivityIndicator size="large" color={purplePrimary} />
                <Text style={[styles.loadingText, { color: textDimColor }]}>Loading courses...</Text>
              </View>
            ) : filteredAndSortedList.length === 0 ? (
              <View style={[styles.emptyContainer, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons
                    name={tab === "purchased" ? "school-outline" : "bookmark-outline"}
                    size={40}
                    color="#6366F1"
                  />
                </View>
                <Text style={[styles.emptyTitle, { color: textColor }]}>
                  {tab === "purchased" ? "No purchased courses yet" : "No saved courses yet"}
                </Text>
                <Text style={[styles.emptySubtitle, { color: textDimColor }]}>
                  {tab === "purchased"
                    ? "Explore our library and start learning new skills today."
                    : "Save courses you are interested in to review them anytime."}
                </Text>
                <Pressable
                  style={[styles.exploreBtn, { backgroundColor: purplePrimary }]}
                  onPress={() => router.push("/(tabs)/")}
                >
                  <Ionicons name="compass-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.exploreBtnText}>Explore Marketplace</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.gridContainer}>
                {filteredAndSortedList.map((course) => {
                  const isSaved = savedIds.has(course.id);
                  const catName = categories.find((c) => c.id === course.categoryId)?.name;

                  return (
                    <Pressable
                      key={`grid-${course.id}`}
                      style={[styles.gridCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
                      onPress={() => router.push(`/course/${course.id}`)}
                    >
                      {/* Thumbnail Image */}
                      <View style={styles.gridThumbContainer}>
                        <CourseThumbnail
                          uri={course.image}
                          title={course.title}
                          style={styles.gridThumb}
                          resizeMode="cover"
                        />
                      </View>

                      {/* Title & Metadata (NO PROGRESS BAR) */}
                      <Text style={[styles.gridCardTitle, { color: textColor }]} numberOfLines={1}>
                        {course.title}
                      </Text>

                      {/* Card Footer: Category / Rating & Action Icons */}
                      <View style={styles.gridFooter}>
                        <Text style={[styles.gridCategoryText, { color: textDimColor }]} numberOfLines={1}>
                          {catName || "Course"}
                        </Text>

                        <View style={styles.gridActionIcons}>
                          <Pressable
                            onPress={() => handleToggleSave(course)}
                            hitSlop={6}
                            style={styles.gridIconBtn}
                          >
                            <Ionicons
                              name={isSaved ? "bookmark" : "bookmark-outline"}
                              size={17}
                              color={isSaved ? "#6366F1" : textDimColor}
                            />
                          </Pressable>

                          <Pressable
                            onPress={() => {
                              setSelectedCourse(course);
                              setShowOptionsModal(true);
                            }}
                            hitSlop={6}
                            style={styles.gridIconBtn}
                          >
                            <Ionicons name="ellipsis-vertical" size={17} color={textDimColor} />
                          </Pressable>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>

        {/* SORT OPTIONS MODAL */}
        <Modal
          visible={showSortModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSortModal(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowSortModal(false)}>
            <View style={[styles.modalSheet, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: textColor }]}>Sort Courses</Text>
                <Pressable onPress={() => setShowSortModal(false)} hitSlop={8}>
                  <Ionicons name="close" size={22} color={textDimColor} />
                </Pressable>
              </View>

              <Pressable
                style={[styles.modalOption, sortBy === "recent" && styles.modalOptionActive]}
                onPress={() => {
                  setSortBy("recent");
                  setShowSortModal(false);
                }}
              >
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={sortBy === "recent" ? purplePrimary : textDimColor}
                />
                <Text
                  style={[
                    styles.modalOptionText,
                    { color: sortBy === "recent" ? purplePrimary : textColor },
                  ]}
                >
                  Recently Added / Purchased
                </Text>
                {sortBy === "recent" && <Ionicons name="checkmark" size={18} color={purplePrimary} />}
              </Pressable>

              <Pressable
                style={[styles.modalOption, sortBy === "title" && styles.modalOptionActive]}
                onPress={() => {
                  setSortBy("title");
                  setShowSortModal(false);
                }}
              >
                <Ionicons
                  name="text-outline"
                  size={20}
                  color={sortBy === "title" ? purplePrimary : textDimColor}
                />
                <Text
                  style={[
                    styles.modalOptionText,
                    { color: sortBy === "title" ? purplePrimary : textColor },
                  ]}
                >
                  Alphabetical (A - Z)
                </Text>
                {sortBy === "title" && <Ionicons name="checkmark" size={18} color={purplePrimary} />}
              </Pressable>

              <Pressable
                style={[styles.modalOption, sortBy === "rating" && styles.modalOptionActive]}
                onPress={() => {
                  setSortBy("rating");
                  setShowSortModal(false);
                }}
              >
                <Ionicons
                  name="star-outline"
                  size={20}
                  color={sortBy === "rating" ? purplePrimary : textDimColor}
                />
                <Text
                  style={[
                    styles.modalOptionText,
                    { color: sortBy === "rating" ? purplePrimary : textColor },
                  ]}
                >
                  Highest Rated
                </Text>
                {sortBy === "rating" && <Ionicons name="checkmark" size={18} color={purplePrimary} />}
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        {/* COURSE OPTIONS ACTION SHEET MODAL */}
        <Modal
          visible={showOptionsModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowOptionsModal(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowOptionsModal(false)}>
            <View style={[styles.modalSheet, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              {selectedCourse && (
                <>
                  <View style={styles.modalCoursePreview}>
                    <CourseThumbnail
                      uri={selectedCourse.image}
                      title={selectedCourse.title}
                      style={styles.modalPreviewThumb}
                      containerStyle={{ width: 44, height: 44, borderRadius: 8 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modalCourseTitle, { color: textColor }]} numberOfLines={1}>
                        {selectedCourse.title}
                      </Text>
                      <Text style={[styles.modalCourseCategory, { color: textDimColor }]}>
                        {categories.find((c) => c.id === selectedCourse.categoryId)?.name || "Course"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.modalDivider} />

                  <Pressable
                    style={styles.modalOption}
                    onPress={() => {
                      setShowOptionsModal(false);
                      handleOpenCourse(selectedCourse);
                    }}
                  >
                    <Ionicons name="play-circle-outline" size={22} color={purplePrimary} />
                    <Text style={[styles.modalOptionText, { color: textColor }]}>Open Course</Text>
                  </Pressable>

                  <Pressable
                    style={styles.modalOption}
                    onPress={() => {
                      setShowOptionsModal(false);
                      router.push({
                        pathname: `/course/${selectedCourse.id}`,
                        params: {
                          initialTitle: selectedCourse.title,
                          initialImage: selectedCourse.image || "",
                          initialPrice: String(selectedCourse.price ?? 0),
                          initialCategoryId: selectedCourse.categoryId || "",
                        }
                      });
                    }}
                  >
                    <Ionicons name="information-circle-outline" size={22} color={textColor} />
                    <Text style={[styles.modalOptionText, { color: textColor }]}>View Course Details</Text>
                  </Pressable>

                  <Pressable
                    style={styles.modalOption}
                    onPress={() => {
                      setShowOptionsModal(false);
                      handleToggleSave(selectedCourse);
                    }}
                  >
                    <Ionicons
                      name={savedIds.has(selectedCourse.id) ? "bookmark" : "bookmark-outline"}
                      size={22}
                      color={savedIds.has(selectedCourse.id) ? "#EF4444" : textColor}
                    />
                    <Text style={[styles.modalOptionText, { color: textColor }]}>
                      {savedIds.has(selectedCourse.id) ? "Remove from Saved" : "Save Course"}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.modalOption}
                    onPress={() => {
                      setShowOptionsModal(false);
                      handleShareCourse(selectedCourse);
                    }}
                  >
                    <Ionicons name="share-social-outline" size={22} color={textColor} />
                    <Text style={[styles.modalOptionText, { color: textColor }]}>Share Course</Text>
                  </Pressable>
                </>
              )}
            </View>
          </Pressable>
        </Modal>
      </FadeInView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: -6,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: "500",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  tabContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 11,
  },
  tabButtonActive: {
    shadowColor: "#5B4DFF",
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  journeyBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 22,
  },
  journeyLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  journeyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  journeyCount: {
    fontSize: 16,
    fontWeight: "800",
  },
  journeySubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  journeyRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgePillText: {
    color: "#A5B4FC",
    fontSize: 11,
    fontWeight: "700",
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  seeAllText: {
    color: "#818CF8",
    fontSize: 13,
    fontWeight: "700",
  },
  continueList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  continueCard: {
    flexDirection: "row",
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    alignItems: "center",
  },
  continueThumbWrapper: {
    width: 125,
    height: 75,
    borderRadius: 12,
    overflow: "hidden",
  },
  continueThumb: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  continueDetails: {
    flex: 1,
    justifyContent: "center",
  },
  continueTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  continueMeta: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 8,
  },
  continueActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 13,
    borderRadius: 18,
  },
  continueBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  moreBtn: {
    padding: 4,
  },
  sortPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
  },
  sortPillText: {
    fontSize: 12,
    fontWeight: "600",
  },
  categoryScroll: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 14,
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 22,
  },
  categoryEmoji: {
    fontSize: 13,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: "600",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    gap: 12,
  },
  gridCard: {
    width: "48%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    marginBottom: 2,
  },
  gridThumbContainer: {
    width: "100%",
    height: 94,
    borderRadius: 12,
    overflow: "hidden",
  },
  gridThumb: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  gridCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 6,
  },
  gridFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  gridCategoryText: {
    fontSize: 11,
    fontWeight: "600",
    flex: 1,
    marginRight: 6,
  },
  gridActionIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  gridIconBtn: {
    padding: 3,
  },
  loadingWrapper: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "500",
  },
  emptyContainer: {
    marginHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  exploreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  exploreBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 38,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
  },
  modalOptionActive: {
    backgroundColor: "rgba(91, 77, 255, 0.08)",
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  modalCoursePreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  modalPreviewThumb: {
    width: 60,
    height: 40,
    borderRadius: 8,
  },
  modalCourseTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  modalCourseCategory: {
    fontSize: 12,
    marginTop: 2,
  },
  modalDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginVertical: 6,
  },
});
