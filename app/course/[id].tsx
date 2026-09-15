import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Share,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "@/utils/clipboard";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getCourse, myPurchases, recordCourseView, listCategories } from "@/services/courses";
import { toggleLike, toggleSave, addComment, listComments, submitReview, fileReport, editComment, deleteComment } from "@/services/social";
import { purchaseCourse, getMyAccessLink } from "@/services/wallet";
import { Course, CourseComment, Category } from "@/types";
import { onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";

const REPORT_REASONS = [
  "Misleading or inaccurate content",
  "Broken video, audio, or download link",
  "Inappropriate or offensive material",
  "Copyright infringement or plagiarism",
  "Spam or scam",
  "Other issue",
];

export default function CourseDetail() {
  const insets = useSafeAreaInsets();
  const { id, promo, discount } = useLocalSearchParams<{ id: string; promo?: string; discount?: string }>();
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();

  const [course, setCourse] = useState<Course | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [owned, setOwned] = useState(false);
  const [comments, setComments] = useState<CourseComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const commentInputRef = useRef<TextInput>(null);
  const [rating, setRating] = useState(0);

  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accessLink, setAccessLink] = useState<string | null>(null);

  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Course reporting state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [reportBusy, setReportBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id || !profile) return;
    try {
      const [purchases, commentList, likeDoc, saveDoc, reviewDoc, catList] = await Promise.all([
        myPurchases(profile.uid),
        listComments(id),
        getDoc(doc(db, "course_likes", `${id}_${profile.uid}`)),
        getDoc(doc(db, "saved_courses", `${id}_${profile.uid}`)),
        getDoc(doc(db, "course_reviews", `${profile.uid}_${id}`)),
        listCategories(),
      ]);
      const isOwned = purchases.some((p: any) => p.courseId === id);
      setOwned(isOwned);
      setComments(commentList as CourseComment[]);
      setLiked(likeDoc.exists());
      setSaved(saveDoc.exists());
      setCategories(catList);
      if (reviewDoc.exists() && typeof reviewDoc.data()?.rating === "number") {
        setRating(reviewDoc.data().rating);
      }
      recordCourseView(id, profile.uid);
      if (isOwned) {
        getMyAccessLink(id).then(setAccessLink).catch(() => {});
      }
    } catch (e) {
      console.error("Course Detail load error:", e);
    }
  }, [id, profile]);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "courses", id), (snap) => {
      if (snap.exists()) setCourse({ id: snap.id, ...snap.data() } as Course);
    });
    return () => unsub();
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function onBuyPress() {
    if (!course) return;
    if (course.price === 0) {
      executePurchase();
      return;
    }
    if ((profile?.balance ?? 0) < finalPrice) {
      return Alert.alert("Insufficient balance", "Top up your wallet first to buy this course.");
    }
    setShowConfirm(true);
  }

  async function executePurchase() {
    if (!course) return;
    setBusy(true);
    try {
      const res = await purchaseCourse(course.id, promo);
      setOwned(true);
      setAccessLink(res.accessLink);
      setShowConfirm(false);
      setShowSuccess(true);
    } catch (e: any) {
      Alert.alert("Purchase failed", e.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onLike() {
    if (!profile || !course) return;
    const newLiked = !liked;
    setLiked(newLiked);
    setCourse((prev) => (prev ? { ...prev, likeCount: Math.max(0, (prev.likeCount || 0) + (newLiked ? 1 : -1)) } : prev));
    const nowLiked = await toggleLike(course.id, profile.uid);
    if (nowLiked !== newLiked) {
      setLiked(nowLiked);
      setCourse((prev) => (prev ? { ...prev, likeCount: Math.max(0, (prev.likeCount || 0) + (nowLiked ? 1 : -1)) } : prev));
    }
  }

  async function onSave() {
    if (!profile || !course) return;
    const newSaved = !saved;
    setSaved(newSaved);
    setCourse((prev) => (prev ? { ...prev, saveCount: Math.max(0, (prev.saveCount || 0) + (newSaved ? 1 : -1)) } : prev));
    const nowSaved = await toggleSave(course.id, profile.uid);
    if (nowSaved !== newSaved) {
      setSaved(nowSaved);
      setCourse((prev) => (prev ? { ...prev, saveCount: Math.max(0, (prev.saveCount || 0) + (nowSaved ? 1 : -1)) } : prev));
    }
  }

  async function handleShare() {
    if (!course) return;
    try {
      await Share.share({
        title: course.title,
        message: `Check out "${course.title}" on CourseArena!\nhttps://coursearena.app/course/${course.id}`,
      });
    } catch (e) {
      console.error("Share error:", e);
    }
  }

  async function copyLink() {
    if (!course) return;
    await Clipboard.setStringAsync(`https://coursearena.app/course/${course.id}`);
    setShowOptionsMenu(false);
    Alert.alert("Link Copied", "Course link copied to clipboard!");
  }

  async function onComment() {
    if (!profile || !course || !commentText.trim()) return;
    if (editingCommentId) {
      await editComment(editingCommentId, commentText.trim());
      setEditingCommentId(null);
    } else {
      await addComment(course.id, profile.uid, commentText.trim());
    }
    setCommentText("");
    load();
  }

  async function onDeleteComment(commentId: string) {
    if (!course) return;
    Alert.alert("Delete Comment", "Are you sure you want to delete this comment?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteComment(commentId, course.id);
          load();
        },
      },
    ]);
  }

  function onReplyComment(userId: string) {
    setCommentText(`@user_${userId.substring(0, 5)} `);
  }

  async function onRate(val: number) {
    if (!profile) {
      return Alert.alert("Sign In Required", "Please sign in to rate this course.");
    }
    if (!course) return;
    setRating(val);
    try {
      const { avgRating, ratingCount } = await submitReview(course.id, profile.uid, val, "");
      setCourse((prev) => (prev ? { ...prev, avgRating, ratingCount } : prev));
      Alert.alert("Rating Submitted", `You gave this course ${val} star${val > 1 ? "s" : ""}! Thank you for rating.`);
    } catch (e: any) {
      console.error("Course rating error:", e);
      Alert.alert("Rating Failed", e.message ?? "Could not submit rating.");
    }
  }

  function onReport() {
    setShowOptionsMenu(false);
    if (!profile) {
      return Alert.alert("Sign In Required", "Please sign in to report this course.");
    }
    setReportReason(REPORT_REASONS[0]);
    setCustomReason("");
    setShowReportModal(true);
  }

  async function submitCourseReport() {
    if (!profile || !course) return;
    const finalReason = reportReason === "Other issue" ? customReason.trim() : reportReason;
    if (!finalReason) {
      return Alert.alert("Reason Required", "Please provide a reason for reporting this course.");
    }
    setReportBusy(true);
    try {
      await fileReport(course.id, profile.uid, finalReason);
      setShowReportModal(false);
      setCourse((prev) => (prev ? { ...prev, reportCount: (prev.reportCount || 0) + 1 } : prev));
      Alert.alert("Report Submitted", "Thank you for reporting. Our moderation team will investigate.");
    } catch (e: any) {
      console.error("Report submit error:", e);
      Alert.alert("Report Failed", e.message ?? "Could not submit report.");
    } finally {
      setReportBusy(false);
    }
  }

  if (!course) {
    return (
      <View style={[styles.loading, { backgroundColor: isDark ? "#0B0F19" : colors.background }]}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  const promoVal = discount ? parseInt(discount, 10) : 0;
  const finalPrice = promoVal > 0 ? course.price * (1 - promoVal / 100) : course.price;
  const categoryName = categories.find((c) => c.id === course.categoryId)?.name || "Business";
  const subtitle = (course as any).subtitle || "Here we go";
  const bg = isDark ? "#0B0F19" : colors.background;
  const cardBg = isDark ? "#121A2B" : colors.card;
  const borderCol = isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0";
  const textColor = isDark ? "#FFFFFF" : "#0F172A";
  const textDimColor = isDark ? "#94A3B8" : "#64748B";

  return (
    <>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.container, { backgroundColor: bg }]}>
          {/* TOP NAVIGATION BAR */}
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
            <Pressable onPress={() => router.back()} style={styles.headerBackBtn} hitSlop={8}>
              <Ionicons name="chevron-back" size={26} color={textColor} />
              <Text style={[styles.headerTitle, { color: textColor }]}>Course</Text>
            </Pressable>

            <View style={styles.headerRightGroup}>
              <Pressable onPress={onLike} style={styles.headerIconBtn} hitSlop={8}>
                <Ionicons name={liked ? "heart" : "heart-outline"} size={24} color={liked ? "#EF4444" : textColor} />
              </Pressable>
              <Pressable onPress={() => setShowOptionsMenu(true)} style={styles.headerIconBtn} hitSlop={8}>
                <Ionicons name="ellipsis-vertical" size={22} color={textColor} />
              </Pressable>
            </View>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* HERO COURSE IMAGE BANNER */}
            <View style={[styles.heroContainer, { borderColor: borderCol }]}>
              {course.image ? (
                <Image source={{ uri: course.image }} style={styles.heroImage} resizeMode="cover" />
              ) : (
                <View style={[styles.heroPlaceholder, { backgroundColor: isDark ? "#1E293B" : "#EEF2F6" }]}>
                  <Ionicons name="play-circle-outline" size={60} color="#6366F1" />
                </View>
              )}
            </View>

            {/* TAGS ROW */}
            <View style={styles.tagsRow}>
              <View style={styles.primaryBadge}>
                <Text style={styles.primaryBadgeText}>{categoryName}</Text>
              </View>
              <View style={[styles.secondaryBadge, { backgroundColor: isDark ? "#1E293B" : "#EEF2F6" }]}>
                <Text style={[styles.secondaryBadgeText, { color: isDark ? "#CBD5E1" : "#475569" }]}>Content Creation</Text>
              </View>
              <View style={[styles.secondaryBadge, { backgroundColor: isDark ? "#1E293B" : "#EEF2F6" }]}>
                <Text style={[styles.secondaryBadgeText, { color: isDark ? "#CBD5E1" : "#475569" }]}>AI Tools</Text>
              </View>
            </View>

            {/* TITLE & SUBTITLE */}
            <View style={styles.titleSection}>
              <Text style={[styles.courseTitle, { color: textColor }]}>{course.title}</Text>
              <Text style={[styles.courseSubtitle, { color: textDimColor }]}>{subtitle}</Text>
            </View>

            {/* METADATA / STATS ROW */}
            <View style={styles.metaRow}>
              <View style={styles.metaRatingGroup}>
                <Ionicons name="star" size={15} color="#FBBF24" />
                <Text style={styles.metaRatingVal}>
                  {(course.avgRating ?? 0) > 0 ? course.avgRating.toFixed(1) : "4.0"}
                </Text>
                <Text style={[styles.metaRatingCount, { color: textDimColor }]}>
                  ({course.ratingCount ?? 0} {course.ratingCount === 1 ? "rate" : "rates"})
                </Text>
              </View>

              <Text style={[styles.metaDot, { color: isDark ? "#475569" : "#CBD5E1" }]}>•</Text>

              <View style={styles.metaStatItem}>
                <Ionicons name="eye-outline" size={16} color={textDimColor} />
                <Text style={[styles.metaStatText, { color: textDimColor }]}>{course.viewCount ?? 0} views</Text>
              </View>

              <Text style={[styles.metaDot, { color: isDark ? "#475569" : "#CBD5E1" }]}>•</Text>

              <View style={styles.metaStatItem}>
                <Ionicons name="globe-outline" size={16} color={textDimColor} />
                <Text style={[styles.metaStatText, { color: textDimColor }]}>Worldwide access</Text>
              </View>
            </View>

            {/* 4 ACTION BUTTONS GRID */}
            <View style={styles.actionsGrid}>
              {/* LIKE */}
              <Pressable style={[styles.actionCard, { backgroundColor: cardBg, borderColor: borderCol }]} onPress={onLike}>
                <View style={styles.actionTopRow}>
                  <Ionicons name={liked ? "heart" : "heart-outline"} size={19} color={liked ? "#EF4444" : textColor} />
                  <Text style={[styles.actionCount, { color: textColor }]}>{course.likeCount || 0}</Text>
                </View>
                <Text style={[styles.actionLabel, { color: textDimColor }]}>Like</Text>
              </Pressable>

              {/* SAVE */}
              <Pressable style={[styles.actionCard, { backgroundColor: cardBg, borderColor: borderCol }]} onPress={onSave}>
                <View style={styles.actionTopRow}>
                  <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={19} color={saved ? "#F59E0B" : textColor} />
                  <Text style={[styles.actionCount, { color: textColor }]}>{course.saveCount || 0}</Text>
                </View>
                <Text style={[styles.actionLabel, { color: textDimColor }]}>Save</Text>
              </Pressable>

              {/* COMMENTS */}
              <Pressable style={[styles.actionCard, { backgroundColor: cardBg, borderColor: borderCol }]} onPress={() => setShowComments(true)}>
                <View style={styles.actionTopRow}>
                  <Ionicons name="chatbubble-outline" size={18} color={textColor} />
                  <Text style={[styles.actionCount, { color: textColor }]}>{course.commentCount ?? comments.length ?? 0}</Text>
                </View>
                <Text style={[styles.actionLabel, { color: textDimColor }]}>Comments</Text>
              </Pressable>

              {/* SHARE */}
              <Pressable style={[styles.actionCard, { backgroundColor: cardBg, borderColor: borderCol }]} onPress={handleShare}>
                <View style={styles.actionTopRow}>
                  <Ionicons name="share-social-outline" size={19} color={textColor} />
                </View>
                <Text style={[styles.actionLabel, { color: textDimColor }]}>Share</Text>
              </Pressable>
            </View>

            {/* MAIN CTA BUTTON (OPEN COURSE / BUY COURSE) */}
            <View style={styles.ctaSection}>
              {promoVal > 0 && !owned && (
                <View style={styles.discountBanner}>
                  <Text style={styles.discountBannerText}>🔥 {promoVal}% Discount Applied!</Text>
                </View>
              )}

              {owned ? (
                <Pressable
                  style={styles.ctaButton}
                  onPress={() => accessLink && router.push({ pathname: "/course/viewer", params: { url: encodeURIComponent(accessLink) } })}
                >
                  <Ionicons name="play" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.ctaButtonText}>Open course</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.ctaButton} onPress={onBuyPress}>
                  <Ionicons name="play" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.ctaButtonText}>
                    {course.price === 0 ? "Open course" : `Buy course - GH₵${finalPrice.toFixed(2)}`}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* ABOUT THIS COURSE CARD */}
            <View style={[styles.cardContainer, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.cardTitle, { color: textColor }]}>About this course</Text>
              <Text
                style={[styles.aboutText, { color: isDark ? "#94A3B8" : "#475569" }]}
                numberOfLines={isExpanded ? undefined : 4}
              >
                {course.description || "A comprehensive collection of educational resources and lessons to master this subject. Perfect for creators, developers, and entrepreneurs seeking actionable skills."}
              </Text>
              <Pressable style={styles.readMoreBtn} onPress={() => setIsExpanded(!isExpanded)}>
                <Text style={styles.readMoreText}>{isExpanded ? "Read less" : "Read more"}</Text>
                <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color="#6366F1" style={{ marginLeft: 4 }} />
              </Pressable>
            </View>

            {/* RATE THIS COURSE CARD */}
            <View style={[styles.cardContainer, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <View style={styles.ratingHeaderRow}>
                <Text style={[styles.cardTitle, { color: textColor }]}>Rate this course</Text>
                <Text style={[styles.ratingCountHeader, { color: textDimColor }]}>
                  {course.ratingCount ?? 0} {course.ratingCount === 1 ? "rate" : "rates"}
                </Text>
              </View>

              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable key={star} onPress={() => onRate(star)} hitSlop={8}>
                    <Ionicons
                      name={rating >= star ? "star" : "star-outline"}
                      size={32}
                      color="#FBBF24"
                    />
                  </Pressable>
                ))}
              </View>

              <View style={[styles.ratingFooterRow, { borderTopColor: borderCol }]}>
                <Text style={[styles.ratingFooterLabel, { color: textDimColor }]}>
                  Average: <Text style={styles.ratingFooterAvg}>★ {(course.avgRating ?? 0) > 0 ? course.avgRating.toFixed(1) : "4.0"}</Text> / 5.0
                </Text>
                <Text style={[styles.ratingFooterLabel, { color: textDimColor }]}>
                  Total Rates: <Text style={[styles.ratingFooterTotal, { color: textColor }]}>{course.ratingCount ?? 0}</Text>
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* THREE-DOTS OPTIONS MENU MODAL */}
      <Modal visible={showOptionsMenu} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setShowOptionsMenu(false)}>
          <View style={[styles.optionsSheet, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <View style={[styles.optionsHandle, { backgroundColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)" }]} />
            <Text style={[styles.optionsSheetTitle, { color: textColor }]}>Course Options</Text>

            <Pressable
              style={[styles.optionRow, { borderBottomColor: borderCol }]}
              onPress={() => {
                setShowOptionsMenu(false);
                handleShare();
              }}
            >
              <Ionicons name="share-social-outline" size={20} color="#6366F1" />
              <Text style={[styles.optionRowText, { color: textColor }]}>Share Course</Text>
            </Pressable>

            <Pressable style={[styles.optionRow, { borderBottomColor: borderCol }]} onPress={copyLink}>
              <Ionicons name="copy-outline" size={20} color="#6366F1" />
              <Text style={[styles.optionRowText, { color: textColor }]}>Copy Course Link</Text>
            </Pressable>

            <Pressable style={[styles.optionRow, { borderBottomColor: borderCol }]} onPress={onReport}>
              <Ionicons name="flag-outline" size={20} color="#EF4444" />
              <Text style={[styles.optionRowText, { color: "#EF4444" }]}>Report Course</Text>
            </Pressable>

            <Pressable
              style={[styles.optionCancelBtn, { borderColor: borderCol }]}
              onPress={() => setShowOptionsMenu(false)}
            >
              <Text style={[styles.optionCancelText, { color: textDimColor }]}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* COMMENTS BOTTOM SHEET */}
      <Modal visible={showComments} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }} onPress={() => setShowComments(false)} />
          <View style={[styles.commentsSheet, { backgroundColor: cardBg }]}>
            <View style={[styles.sheetHeader, { borderBottomColor: borderCol }]}>
              <Text style={[styles.sheetTitle, { color: textColor }]}>{comments.length} comments</Text>
              <Pressable onPress={() => setShowComments(false)} style={styles.sheetClose}>
                <Ionicons name="close" size={24} color={textColor} />
              </Pressable>
            </View>
            <ScrollView style={{ flex: 1, paddingHorizontal: 20 }}>
              {comments.map((c) => (
                <View key={c.id} style={[styles.commentRow, { backgroundColor: isDark ? "#1E293B" : "#F8FAFC" }]}>
                  <Text style={[styles.commentText, { color: textColor }]}>{c.message}</Text>
                  <View style={styles.commentActions}>
                    <Pressable onPress={() => onReplyComment(c.userId)}>
                      <Text style={[styles.commentActionText, { color: textDimColor }]}>Reply</Text>
                    </Pressable>
                    {c.userId === profile?.uid && (
                      <>
                        <Pressable
                          onPress={() => {
                            setEditingCommentId(c.id);
                            setCommentText(c.message);
                          }}
                        >
                          <Text style={[styles.commentActionText, { color: "#6366F1" }]}>Edit</Text>
                        </Pressable>
                        <Pressable onPress={() => onDeleteComment(c.id)}>
                          <Text style={[styles.commentActionText, { color: "#EF4444" }]}>Delete</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={[styles.sheetInputContainer, { borderTopColor: borderCol, backgroundColor: cardBg }]}>
              <TextInput
                ref={commentInputRef}
                style={[
                  styles.sheetInput,
                  {
                    backgroundColor: isDark ? "#0B0F19" : "#F1F5F9",
                    color: textColor,
                    borderColor: borderCol,
                  },
                ]}
                placeholder="Add a comment..."
                placeholderTextColor={textDimColor}
                value={commentText}
                onChangeText={setCommentText}
              />
              <Pressable onPress={onComment} style={{ padding: 8 }}>
                <Ionicons name={editingCommentId ? "checkmark" : "send"} size={22} color="#6366F1" />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* CONFIRM PURCHASE MODAL */}
      <Modal visible={showConfirm} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <View style={styles.modalIconCircleOrange}>
              <Ionicons name="cart-outline" size={32} color="#D97706" />
            </View>
            <Text style={[styles.modalTitle, { color: textColor }]}>Confirm Purchase</Text>

            <View style={[styles.modalCourseCard, { backgroundColor: isDark ? "#0B0F19" : "#F1F5F9", borderColor: borderCol }]}>
              {course.image ? (
                <Image source={{ uri: course.image }} style={styles.modalCourseImg} />
              ) : (
                <View style={[styles.modalCourseImg, { backgroundColor: isDark ? "#334155" : "#E2E8F0" }]} />
              )}
              <Text style={[styles.modalCourseTitle, { color: textColor }]} numberOfLines={2}>
                {course.title}
              </Text>
            </View>

            <View style={styles.modalRow}>
              <Text style={[styles.modalRowLabel, { color: textDimColor }]}>Price</Text>
              <Text style={[styles.modalRowValue, { color: textColor }]}>GH₵{finalPrice.toFixed(2)}</Text>
            </View>
            <View style={[styles.dashedLine, { borderColor: borderCol }]} />
            <View style={styles.modalRow}>
              <Text style={[styles.modalRowLabel, { color: textDimColor }]}>Current balance</Text>
              <Text style={[styles.modalRowValue, { color: textColor }]}>GH₵{(profile?.balance ?? 0).toFixed(2)}</Text>
            </View>
            <View style={[styles.dashedLine, { borderColor: borderCol }]} />

            <View style={styles.modalBtnRow}>
              <Pressable style={[styles.modalBtnCancel, { borderColor: borderCol }]} onPress={() => setShowConfirm(false)} disabled={busy}>
                <Text style={[styles.modalBtnCancelText, { color: textColor }]}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalBtnConfirm} onPress={executePurchase} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnConfirmText}>Confirm Purchase</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* SUCCESS MODAL */}
      <Modal visible={showSuccess} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <Pressable style={styles.modalCloseIcon} onPress={() => setShowSuccess(false)}>
              <Ionicons name="close" size={24} color={textDimColor} />
            </Pressable>

            <View style={styles.modalIconCircleGreen}>
              <Ionicons name="checkmark" size={40} color="#10B981" />
            </View>

            <Text style={[styles.modalTitle, { color: textColor }]}>
              Purchase <Text style={{ color: "#10B981" }}>Successful!</Text>
            </Text>
            <Text style={[styles.modalSubtitle, { color: textDimColor }]}>You are now enrolled in this course.</Text>

            <View style={[styles.modalCourseCardGreen, { backgroundColor: "rgba(16, 185, 129, 0.1)", borderColor: "#10B981" }]}>
              {course.image ? (
                <Image source={{ uri: course.image }} style={styles.modalCourseImg} />
              ) : (
                <View style={[styles.modalCourseImg, { backgroundColor: isDark ? "#334155" : "#E2E8F0" }]} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalCourseTitle, { color: textColor }]} numberOfLines={2}>
                  {course.title}
                </Text>
                <Text style={{ color: textDimColor, fontSize: 11, marginTop: 4 }}>You now have lifetime access to this course.</Text>
              </View>
            </View>

            <Pressable
              style={styles.modalBtnOpen}
              onPress={() => {
                setShowSuccess(false);
                if (accessLink) router.push({ pathname: "/course/viewer", params: { url: encodeURIComponent(accessLink) } });
              }}
            >
              <Ionicons name="play" size={18} color="#FFF" />
              <Text style={styles.modalBtnOpenText}>Open Course ➔</Text>
            </Pressable>
            <Pressable style={[styles.modalBtnBrowse, { borderColor: borderCol }]} onPress={() => { setShowSuccess(false); router.push("/(tabs)/"); }}>
              <Text style={[styles.modalBtnBrowseText, { color: textColor }]}>Continue Browsing</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* REPORT COURSE MODAL */}
      <Modal visible={showReportModal} transparent animationType="fade">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalContent, { backgroundColor: cardBg, borderColor: borderCol, maxHeight: "90%" }]}>
              <Pressable style={styles.modalCloseIcon} onPress={() => setShowReportModal(false)}>
                <Ionicons name="close" size={24} color={textDimColor} />
              </Pressable>

              <View style={styles.modalIconCircleRed}>
                <Ionicons name="flag" size={32} color="#EF4444" />
              </View>

              <Text style={[styles.modalTitle, { color: textColor }]}>Report Course</Text>
              <Text style={[styles.modalSubtitle, { color: textDimColor, textAlign: "center" }]}>
                Help us keep CourseArena safe. Tell us what is wrong with this course.
              </Text>

              <ScrollView style={{ width: "100%", maxHeight: 260 }} showsVerticalScrollIndicator={false}>
                {REPORT_REASONS.map((r) => (
                  <Pressable
                    key={r}
                    style={[
                      styles.reportOption,
                      {
                        borderColor: reportReason === r ? "#6366F1" : borderCol,
                        backgroundColor: reportReason === r ? "rgba(99,102,241,0.15)" : (isDark ? "#0B0F19" : "#F8FAFC"),
                      },
                    ]}
                    onPress={() => setReportReason(r)}
                  >
                    <Ionicons
                      name={reportReason === r ? "radio-button-on" : "radio-button-off"}
                      size={20}
                      color={reportReason === r ? "#6366F1" : textDimColor}
                    />
                    <Text style={[styles.reportOptionText, { color: textColor }]}>{r}</Text>
                  </Pressable>
                ))}

                {reportReason === "Other issue" && (
                  <TextInput
                    style={[
                      styles.reportCustomInput,
                      {
                        backgroundColor: isDark ? "#0B0F19" : "#F1F5F9",
                        borderColor: borderCol,
                        color: textColor,
                      },
                    ]}
                    placeholder="Describe the issue in detail..."
                    placeholderTextColor={textDimColor}
                    value={customReason}
                    onChangeText={setCustomReason}
                    multiline
                    numberOfLines={3}
                  />
                )}
              </ScrollView>

              <View style={styles.modalBtnRow}>
                <Pressable
                  style={[styles.modalBtnCancel, { borderColor: borderCol }]}
                  onPress={() => setShowReportModal(false)}
                  disabled={reportBusy}
                >
                  <Text style={[styles.modalBtnCancelText, { color: textColor }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalBtnConfirm, { backgroundColor: "#EF4444" }]}
                  onPress={submitCourseReport}
                  disabled={reportBusy}
                >
                  {reportBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnConfirmText}>Submit Report</Text>}
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },

  // TOP NAVIGATION HEADER
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  headerRightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headerIconBtn: {
    padding: 4,
  },

  // HERO IMAGE CARD
  heroContainer: {
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: 18,
    overflow: "hidden",
    height: 235,
    borderWidth: 1,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  // TAGS / BADGES ROW
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
    flexWrap: "wrap",
  },
  primaryBadge: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  primaryBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  secondaryBadge: {
    backgroundColor: "#1E293B",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  secondaryBadgeText: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "500",
  },

  // TITLE & SUBTITLE
  titleSection: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  courseTitle: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  courseSubtitle: {
    fontSize: 15,
    color: "#94A3B8",
    marginTop: 4,
    fontWeight: "500",
  },

  // METADATA / STATS ROW
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 10,
    flexWrap: "wrap",
    gap: 8,
  },
  metaRatingGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaRatingVal: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FBBF24",
  },
  metaRatingCount: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "500",
  },
  metaDot: {
    fontSize: 13,
    color: "#475569",
  },
  metaStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaStatText: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "500",
  },

  // ACTIONS 4-GRID
  actionsGrid: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 18,
    gap: 10,
  },
  actionCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  actionCount: {
    fontSize: 13,
    fontWeight: "600",
  },
  actionLabel: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "500",
  },

  // CTA BUTTON
  ctaSection: {
    marginHorizontal: 16,
    marginTop: 18,
  },
  discountBanner: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  discountBannerText: {
    color: "#10B981",
    fontSize: 13,
    fontWeight: "700",
  },
  ctaButton: {
    backgroundColor: "#5B4DF5",
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },

  // ABOUT & RATE CONTAINER CARDS
  cardContainer: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
  },
  aboutText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#94A3B8",
  },
  readMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    alignSelf: "flex-start",
  },
  readMoreText: {
    color: "#6366F1",
    fontSize: 13,
    fontWeight: "600",
  },

  // RATE THIS COURSE
  ratingHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  ratingCountHeader: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "500",
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginVertical: 10,
  },
  ratingFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  ratingFooterLabel: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "500",
  },
  ratingFooterAvg: {
    color: "#F59E0B",
    fontWeight: "700",
  },
  ratingFooterTotal: {
    fontWeight: "700",
  },

  // OPTIONS MENU MODAL
  optionsSheet: {
    width: "90%",
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
  },
  optionsHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginBottom: 14,
  },
  optionsSheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  optionRowText: {
    fontSize: 15,
    fontWeight: "600",
  },
  optionCancelBtn: {
    marginTop: 16,
    width: "100%",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  optionCancelText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "600",
  },

  // COMMENTS BOTTOM SHEET
  commentsSheet: {
    height: "75%",
    width: "100%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
  },
  sheetTitle: { fontSize: 18, fontWeight: "800" },
  sheetClose: { padding: 4 },
  commentRow: { borderRadius: 12, padding: 16, marginBottom: 12 },
  commentText: { fontSize: 14, lineHeight: 20 },
  commentActions: { flexDirection: "row", gap: 16, marginTop: 10 },
  commentActionText: { fontSize: 12, fontWeight: "600" },
  sheetInputContainer: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    alignItems: "center",
    gap: 10,
  },
  sheetInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
  },

  // MODAL SHARED STYLES
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    position: "relative",
  },
  modalCloseIcon: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 20,
  },
  modalIconCircleOrange: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  modalIconCircleGreen: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  modalIconCircleRed: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 22, fontWeight: "800", marginBottom: 8 },
  modalSubtitle: { fontSize: 14, marginBottom: 20 },
  modalCourseCard: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  modalCourseCardGreen: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  modalCourseImg: { width: 50, height: 50, borderRadius: 10, marginRight: 12 },
  modalCourseTitle: { fontSize: 14, fontWeight: "700", flex: 1 },
  modalRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginVertical: 12 },
  modalRowLabel: { fontSize: 14 },
  modalRowValue: { fontSize: 14, fontWeight: "700" },
  dashedLine: { width: "100%", borderWidth: 1, borderStyle: "dashed", opacity: 0.3 },
  modalBtnRow: { flexDirection: "row", gap: 12, width: "100%", marginTop: 24 },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnCancelText: { fontWeight: "700", fontSize: 15 },
  modalBtnConfirm: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#5B4DF5",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnConfirmText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  modalBtnOpen: {
    flexDirection: "row",
    width: "100%",
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  modalBtnOpenText: { color: "#FFFFFF", fontWeight: "800", fontSize: 16 },
  modalBtnBrowse: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnBrowseText: { fontWeight: "700", fontSize: 15 },

  // REPORT MODAL
  reportOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  reportOptionText: { fontSize: 14, fontWeight: "500", flex: 1 },
  reportCustomInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 4,
    marginBottom: 10,
    minHeight: 70,
    textAlignVertical: "top",
  },
});
