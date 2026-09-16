import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator, Alert, ScrollView, Animated, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ComboGiveaway, buyComboGiveaway } from "@/services/combos";
import { listPublishedCourses } from "@/services/courses";
import { Course } from "@/types";
import { normalizeImageUrl } from "@/utils/imageUrl";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";
import { BlurView } from "expo-blur";
import { CourseThumbnail } from "@/components/CourseThumbnail";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { height, width } = Dimensions.get("window");

interface GiveawayPopupProps {
  combo: ComboGiveaway;
  onClose: () => void;
  onSuccess: () => void;
}

export default function GiveawayPopup({ combo, onClose, onSuccess }: GiveawayPopupProps) {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBuying, setIsBuying] = useState(false);
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true })
    ]).start();

    const load = async () => {
      try {
        const all = await listPublishedCourses({ max: 100 });
        const selected = all.filter(c => combo.courseIds.includes(c.id));
        setCourses(selected);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [combo]);

  const closePopup = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true })
    ]).start(() => onClose());
  };

  const handleBuy = async () => {
    if (!profile?.uid) return;
    setIsBuying(true);
    try {
      await buyComboGiveaway(profile.uid, combo);
      await AsyncStorage.setItem(`@coursearena_combo_purchased_${combo.id}`, "true");
      onSuccess();
    } catch (e: any) {
      Alert.alert("Purchase Failed", e.message || "Something went wrong");
    } finally {
      setIsBuying(false);
    }
  };

  const totalOriginalValue = courses.reduce((acc, curr) => acc + (curr.price || 0), 0);

  return (
    <Modal visible transparent animationType="none">
      <BlurView intensity={70} tint="dark" style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closePopup} />
        
        <Animated.View style={[styles.modalContent, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <Pressable style={styles.closeBtn} onPress={closePopup}>
            <Ionicons name="close-circle" size={32} color="rgba(255,255,255,0.7)" />
          </Pressable>

          <View style={styles.glowOrb} />
          
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.headerIcon}>
              <Ionicons name="flash" size={36} color="#FBBF24" />
            </View>

            <Text style={styles.title}>{combo.title}</Text>
            <Text style={styles.subtitle}>Unlock this exclusive bundle instantly at a massive discount!</Text>

            {loading ? (
              <ActivityIndicator color="#6366F1" style={{ marginVertical: 40 }} size="large" />
            ) : (
              <View style={styles.courseList}>
                {courses.map((course, index) => (
                  <Pressable 
                    key={course.id} 
                    style={styles.courseCard}
                    onPress={() => {
                      closePopup();
                      router.push(`/course/${course.id}`);
                    }}
                  >
                    <CourseThumbnail 
                      uri={normalizeImageUrl(course.image)} 
                      title={course.title} 
                      style={styles.courseImg}
                    />
                    <View style={styles.courseInfo}>
                      <Text style={styles.courseTitle} numberOfLines={2}>{course.title}</Text>
                      <View style={styles.courseMetaRow}>
                        <Ionicons name="star" size={14} color="#FBBF24" />
                        <Text style={styles.courseRating}>{(course.avgRating || 4.5).toFixed(1)}</Text>
                        <Text style={styles.courseOriginalPrice}>Original: GH₵ {course.price}</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" style={{ marginRight: 8 }} />
                  </Pressable>
                ))}
              </View>
            )}

            {!loading && (
              <View style={styles.priceContainer}>
                <View style={styles.priceRow}>
                  <Text style={styles.totalValueText}>Total Value: GH₵ {totalOriginalValue.toFixed(2)}</Text>
                  <View style={styles.saveBadge}>
                    <Text style={styles.saveBadgeText}>
                      SAVE {Math.round((1 - combo.price / totalOriginalValue) * 100)}%
                    </Text>
                  </View>
                </View>
                <Text style={styles.comboPrice}>Buy Combo for GH₵ {combo.price}</Text>
              </View>
            )}

            <Pressable 
              style={({ pressed }) => [styles.buyBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]} 
              onPress={handleBuy} 
              disabled={isBuying || loading}
            >
              {isBuying ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buyBtnText}>GET IT NOW ➔</Text>
              )}
            </Pressable>
          </ScrollView>
        </Animated.View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    width: "100%",
    maxWidth: 420,
    maxHeight: height * 0.85,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.4)",
    overflow: "hidden",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  glowOrb: {
    position: "absolute",
    top: -50,
    left: "50%",
    marginLeft: -100,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(99, 102, 241, 0.25)",
    transform: [{ scaleX: 2 }],
    opacity: 0.6,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 32,
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
  },
  headerIcon: {
    alignSelf: "center",
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    padding: 16,
    borderRadius: 40,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.3)",
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 15,
    color: "#94A3B8",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  courseList: {
    gap: 12,
    marginBottom: 24,
  },
  courseCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 20,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  courseImg: {
    width: 70,
    height: 70,
    borderRadius: 14,
  },
  courseInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: "center",
  },
  courseTitle: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  courseMetaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  courseRating: {
    color: "#FBBF24",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 4,
    marginRight: 12,
  },
  courseOriginalPrice: {
    color: "#64748B",
    fontSize: 13,
    textDecorationLine: "line-through",
  },
  priceContainer: {
    backgroundColor: "rgba(99, 102, 241, 0.1)",
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
    alignItems: "center",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  totalValueText: {
    color: "#94A3B8",
    fontSize: 15,
    textDecorationLine: "line-through",
    marginRight: 12,
  },
  saveBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  saveBadgeText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "bold",
  },
  comboPrice: {
    color: "#10B981",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  buyBtn: {
    backgroundColor: "#6366F1",
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  buyBtnText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 1,
  },
});
