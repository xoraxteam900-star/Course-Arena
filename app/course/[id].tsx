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
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getCourse, myPurchases, recordCourseView } from "@/services/courses";
import { toggleLike, toggleSave, addComment, listComments, submitReview, fileReport, editComment, deleteComment } from "@/services/social";
import { purchaseCourse, getMyAccessLink } from "@/services/wallet";
import { Course, CourseComment } from "@/types";
import { onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";

export default function CourseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();
  
  const [course, setCourse] = useState<Course | null>(null);
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

  const load = useCallback(async () => {
    if (!id || !profile) return;
    try {
      const [purchases, commentList, likeDoc, saveDoc] = await Promise.all([
        myPurchases(profile.uid),
        listComments(id),
        getDoc(doc(db, "course_likes", `${id}_${profile.uid}`)),
        getDoc(doc(db, "saved_courses", `${id}_${profile.uid}`)),
      ]);
      const isOwned = purchases.some((p: any) => p.courseId === id);
      setOwned(isOwned);
      setComments(commentList as CourseComment[]);
      setLiked(likeDoc.exists());
      setSaved(saveDoc.exists());
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
    if ((profile?.balance ?? 0) < course.price) {
      return Alert.alert("Insufficient balance", "Top up your wallet first.");
    }
    setShowConfirm(true);
  }

  async function executePurchase() {
    if (!course) return;
    setBusy(true);
    try {
      const res = await purchaseCourse(course.id);
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
    setCourse(prev => prev ? { ...prev, likeCount: (prev.likeCount || 0) + (newLiked ? 1 : -1) } : prev);
    const nowLiked = await toggleLike(course.id, profile.uid);
    if (nowLiked !== newLiked) {
      setLiked(nowLiked);
      setCourse(prev => prev ? { ...prev, likeCount: (prev.likeCount || 0) + (nowLiked ? 1 : -1) } : prev);
    }
  }

  async function onSave() {
    if (!profile || !course) return;
    const newSaved = !saved;
    setSaved(newSaved);
    setCourse(prev => prev ? { ...prev, saveCount: (prev.saveCount || 0) + (newSaved ? 1 : -1) } : prev);
    const nowSaved = await toggleSave(course.id, profile.uid);
    if (nowSaved !== newSaved) {
      setSaved(nowSaved);
      setCourse(prev => prev ? { ...prev, saveCount: (prev.saveCount || 0) + (nowSaved ? 1 : -1) } : prev);
    }
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
      { text: "Delete", style: "destructive", onPress: async () => {
        await deleteComment(commentId, course.id);
        load();
      }},
    ]);
  }

  function onReplyComment(userId: string) {
    // For simplicity, we just pre-fill a mention. In a real app we might fetch user display names.
    setCommentText(`@user_${userId.substring(0,5)} `);
  }

  async function onRate(val: number) {
    if (!profile || !course || !owned) return;
    setRating(val);
    await submitReview(course.id, profile.uid, val, "");
    Alert.alert("Rating Submitted", "Thank you for rating this course!");
    load();
  }

  async function onReport() {
    if (!profile || !course) return;
    Alert.prompt?.("Report this course", "What's the issue?", async (reason) => {
      if (reason) {
        await fileReport(course.id, profile.uid, reason);
        Alert.alert("Report submitted", "Our team will review it.");
      }
    });
  }

  if (!course) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        {course.image ? <Image source={{ uri: course.image }} style={styles.hero} /> : <View style={[styles.hero, { backgroundColor: colors.border }]} />}
        <View style={{ padding: 20 }}>
          <Text style={[styles.title, { color: colors.text }]}>{course.title}</Text>
          <Text style={[styles.meta, { color: colors.textDim }]}>★ {course.avgRating?.toFixed?.(1) ?? "0.0"} ({course.ratingCount ?? 0}) · {course.viewCount ?? 0} views</Text>
          <Text style={[styles.description, { color: colors.textDim }]}>{course.description}</Text>

          <View style={styles.actionsRow}>
            <Pressable style={[styles.iconBtn, { backgroundColor: colors.card, shadowColor: colors.shadow, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 }]} onPress={onLike}>
              <Ionicons name={liked ? "heart" : "heart-outline"} size={22} color={liked ? "#F87171" : colors.textDim} />
              <Text style={{ color: colors.textDim, fontSize: 13, fontWeight: "600" }}>{course.likeCount || 0}</Text>
            </Pressable>
            <Pressable style={[styles.iconBtn, { backgroundColor: colors.card, shadowColor: colors.shadow, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 }]} onPress={onSave}>
              <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={22} color={saved ? "#FBBF24" : colors.textDim} />
              <Text style={{ color: colors.textDim, fontSize: 13, fontWeight: "600" }}>{course.saveCount || 0}</Text>
            </Pressable>
            <Pressable style={[styles.iconBtn, { backgroundColor: colors.card, shadowColor: colors.shadow, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 }]} onPress={() => setShowComments(true)}>
              <Ionicons name="chatbubble-outline" size={22} color={colors.textDim} />
              <Text style={{ color: colors.textDim, fontSize: 13, fontWeight: "600" }}>{course.commentCount || 0}</Text>
            </Pressable>
            <Pressable style={[styles.iconBtn, { backgroundColor: colors.card, shadowColor: colors.shadow, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 }]} onPress={onReport}>
              <Ionicons name="flag-outline" size={22} color={colors.textDim} />
            </Pressable>
          </View>

          {owned ? (
            <View style={{ marginTop: 20 }}>
              <Pressable style={[styles.buyBtn, { backgroundColor: colors.primary }]} onPress={() => accessLink && router.push({ pathname: "/course/viewer", params: { url: encodeURIComponent(accessLink) } })}>
                <Text style={styles.buyBtnText}>Open course</Text>
              </Pressable>
              
              <View style={[styles.ratingContainer, { backgroundColor: colors.card, shadowColor: colors.shadow, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 }]}>
                <Text style={[styles.ratingTitle, { color: colors.text }]}>Rate this course</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Pressable key={star} onPress={() => onRate(star)}>
                      <Ionicons name={rating >= star ? "star" : "star-outline"} size={32} color="#FBBF24" />
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          ) : (
            <Pressable style={[styles.buyBtn, { backgroundColor: colors.primary }]} onPress={onBuyPress}>
              <Text style={styles.buyBtnText}>Buy for GH₵{course.price.toFixed(2)}</Text>
            </Pressable>
          )}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>

      {/* COMMENTS BOTTOM SHEET */}
      <Modal visible={showComments} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} onPress={() => setShowComments(false)} />
          <View style={[styles.commentsSheet, { backgroundColor: colors.background }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>{comments.length} comments</Text>
              <Pressable onPress={() => setShowComments(false)} style={styles.sheetClose}>
                <Ionicons name="close" size={24} color={colors.textDim} />
              </Pressable>
            </View>
            <ScrollView style={{ flex: 1, paddingHorizontal: 20 }}>
              {comments.map((c) => (
                <View key={c.id} style={[styles.commentRow, { backgroundColor: colors.card, shadowColor: colors.shadow, shadowOpacity: 0.03, shadowRadius: 5, elevation: 1 }]}>
                  <Text style={[styles.commentText, { color: colors.text }]}>{c.message}</Text>
                  <View style={styles.commentActions}>
                    <Pressable onPress={() => onReplyComment(c.userId)}>
                      <Text style={[styles.commentActionText, { color: colors.textDim }]}>Reply</Text>
                    </Pressable>
                    {c.userId === profile?.uid && (
                      <>
                        <Pressable onPress={() => { setEditingCommentId(c.id); setCommentText(c.message); }}>
                          <Text style={[styles.commentActionText, { color: colors.primary }]}>Edit</Text>
                        </Pressable>
                        <Pressable onPress={() => onDeleteComment(c.id)}>
                          <Text style={[styles.commentActionText, { color: "#F87171" }]}>Delete</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={[styles.sheetInputContainer, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
              <TextInput
                ref={commentInputRef}
                style={[styles.sheetInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="Add a comment..."
                placeholderTextColor={colors.textDim}
                value={commentText}
                onChangeText={setCommentText}
              />
              <Pressable onPress={onComment} style={{ padding: 8 }}>
                <Ionicons name={editingCommentId ? "checkmark" : "send"} size={22} color={colors.primary} />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* CONFIRM PURCHASE MODAL */}
      <Modal visible={showConfirm} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalIconCircleOrange}>
              <Ionicons name="cart-outline" size={32} color="#D97706" />
            </View>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Confirm purchase</Text>
            
            <View style={[styles.modalCourseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {course.image ? <Image source={{ uri: course.image }} style={styles.modalCourseImg} /> : <View style={[styles.modalCourseImg, { backgroundColor: colors.border }]} />}
              <Text style={[styles.modalCourseTitle, { color: colors.text }]} numberOfLines={2}>{course.title}</Text>
            </View>

            <View style={styles.modalRow}>
              <Text style={[styles.modalRowLabel, { color: colors.textDim }]}>Price</Text>
              <Text style={[styles.modalRowValue, { color: colors.text }]}>GH₵{course.price.toFixed(2)}</Text>
            </View>
            <View style={[styles.dashedLine, { borderColor: colors.border }]} />
            <View style={styles.modalRow}>
              <Text style={[styles.modalRowLabel, { color: colors.textDim }]}>Current balance</Text>
              <Text style={[styles.modalRowValue, { color: colors.text }]}>GH₵{(profile?.balance ?? 0).toFixed(2)}</Text>
            </View>
            <View style={[styles.dashedLine, { borderColor: colors.border }]} />

            <View style={styles.modalBtnRow}>
              <Pressable style={[styles.modalBtnCancel, { borderColor: colors.border }]} onPress={() => setShowConfirm(false)} disabled={busy}>
                <Text style={[styles.modalBtnCancelText, { color: colors.text }]}>Cancel</Text>
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
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Pressable style={styles.modalCloseIcon} onPress={() => setShowSuccess(false)}>
              <Ionicons name="close" size={24} color={colors.textDim} />
            </Pressable>

            <View style={styles.modalIconCircleGreen}>
              <Ionicons name="checkmark" size={40} color="#10B981" />
            </View>
            
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Purchase <Text style={{ color: "#10B981" }}>Successful!</Text>
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textDim }]}>Thank you for buying</Text>
            
            <View style={[styles.modalCourseCardGreen, { backgroundColor: isDark ? "rgba(16, 185, 129, 0.1)" : "#ECFDF5", borderColor: "#10B981" }]}>
              {course.image ? <Image source={{ uri: course.image }} style={styles.modalCourseImg} /> : <View style={[styles.modalCourseImg, { backgroundColor: colors.border }]} />}
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalCourseTitle, { color: colors.text }]} numberOfLines={2}>{course.title}</Text>
                <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 4 }}>You now have lifetime access to this course.</Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 24, gap: 8 }}>
              <View style={{ backgroundColor: "#10B981", borderRadius: 10, padding: 2 }}><Ionicons name="checkmark" size={14} color="#FFF" /></View>
              <Text style={{ color: colors.textDim, fontSize: 13 }}>Your course has been added to <Text style={{ color: "#10B981", fontWeight: "700" }}>My Courses</Text>.</Text>
            </View>

            <Pressable style={styles.modalBtnOpen} onPress={() => { setShowSuccess(false); if (accessLink) router.push({ pathname: "/course/viewer", params: { url: encodeURIComponent(accessLink) } }); }}>
              <Ionicons name="book-outline" size={18} color="#FFF" />
              <Text style={styles.modalBtnOpenText}>Open Course ➔</Text>
            </Pressable>
            <Pressable style={[styles.modalBtnBrowse, { borderColor: colors.border }]} onPress={() => { setShowSuccess(false); router.push("/(tabs)/"); }}>
              <Text style={[styles.modalBtnBrowseText, { color: colors.text }]}>Continue Browsing</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: { width: "100%", height: 220 },
  title: { fontSize: 22, fontWeight: "800" },
  meta: { marginTop: 6 },
  description: { marginTop: 16, lineHeight: 22 },
  actionsRow: { flexDirection: "row", gap: 16, marginTop: 24 },
  iconBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  buyBtn: { borderRadius: 12, padding: 16, alignItems: "center", marginTop: 20 },
  buyBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  
  ratingContainer: { marginTop: 20, padding: 20, borderRadius: 16, alignItems: "center" },
  ratingTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  starsRow: { flexDirection: "row", gap: 8 },

  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 32, marginBottom: 16 },
  commentInputRow: { flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 20 },
  commentInput: { flex: 1, borderRadius: 12, padding: 14, borderWidth: 1 },
  
  commentRow: { borderRadius: 12, padding: 16, marginBottom: 12 },
  commentText: { fontSize: 14, lineHeight: 20 },
  commentActions: { flexDirection: "row", gap: 16, marginTop: 10 },
  commentActionText: { fontSize: 12, fontWeight: "600" },

  commentsSheet: { height: "75%", width: "100%", borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)" },
  sheetTitle: { fontSize: 18, fontWeight: "800" },
  sheetClose: { padding: 4 },
  sheetInputContainer: { flexDirection: "row", padding: 16, borderTopWidth: 1, alignItems: "center", gap: 10 },
  sheetInput: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalContent: { width: "100%", borderRadius: 24, padding: 24, alignItems: "center", position: "relative" },
  modalCloseIcon: { position: "absolute", top: 16, right: 16, padding: 8, backgroundColor: "rgba(0,0,0,0.05)", borderRadius: 20 },
  modalIconCircleOrange: { width: 70, height: 70, borderRadius: 35, backgroundColor: "#FEF3C7", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  modalIconCircleGreen: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#D1FAE5", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  modalTitle: { fontSize: 22, fontWeight: "800", marginBottom: 8 },
  modalSubtitle: { fontSize: 14, marginBottom: 20 },
  modalCourseCard: { flexDirection: "row", alignItems: "center", width: "100%", padding: 12, borderRadius: 16, borderWidth: 1, marginBottom: 24 },
  modalCourseCardGreen: { flexDirection: "row", alignItems: "center", width: "100%", padding: 12, borderRadius: 16, borderWidth: 1, marginBottom: 20 },
  modalCourseImg: { width: 50, height: 50, borderRadius: 10, marginRight: 12 },
  modalCourseTitle: { fontSize: 14, fontWeight: "700", flex: 1 },
  modalRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginVertical: 12 },
  modalRowLabel: { fontSize: 14 },
  modalRowValue: { fontSize: 14, fontWeight: "700" },
  dashedLine: { width: "100%", borderWidth: 1, borderStyle: "dashed", opacity: 0.3 },
  modalBtnRow: { flexDirection: "row", gap: 12, width: "100%", marginTop: 24 },
  modalBtnCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  modalBtnCancelText: { fontWeight: "700", fontSize: 15 },
  modalBtnConfirm: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#F59E0B", alignItems: "center", justifyContent: "center" },
  modalBtnConfirmText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  modalBtnOpen: { flexDirection: "row", width: "100%", paddingVertical: 16, borderRadius: 12, backgroundColor: "#10B981", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 },
  modalBtnOpenText: { color: "#FFFFFF", fontWeight: "800", fontSize: 16 },
  modalBtnBrowse: { width: "100%", paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  modalBtnBrowseText: { fontWeight: "700", fontSize: 15 },
});
