import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";

const { width, height } = Dimensions.get("window");

interface PolicyModalProps {
  visible: boolean;
  onClose: () => void;
  onAccept?: () => void;
  showAcceptButton?: boolean;
}

export function PolicyModal({
  visible,
  onClose,
  onAccept,
  showAcceptButton = true,
}: PolicyModalProps) {
  const { isDark, colors } = useTheme();
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  const cardBg = isDark ? "#101625" : "#FFFFFF";
  const sectionBg = isDark ? "#1E293B" : "#F8FAFC";
  const borderCol = isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0";
  const textColor = isDark ? "#FFFFFF" : "#0F172A";
  const textDimColor = isDark ? "#94A3B8" : "#64748B";

  const policySections = [
    {
      icon: "person-circle-outline",
      iconColor: "#6366F1",
      title: "1-Person Independent Project",
      subtitle: "Independent Educational Platform",
      text: "Course Arena is an independent educational platform developed and maintained as a solo (1-man) project. It is not an officially registered corporate entity or company.",
    },
    {
      icon: "school-outline",
      iconColor: "#10B981",
      title: "Strictly Educational Purposes Only",
      subtitle: "Learning & Knowledge Sharing",
      text: "All courses, videos, tutorials, files, and materials posted or sold on Course Arena are strictly intended for educational, research, and self-learning purposes only.",
    },
    {
      icon: "flask-outline",
      iconColor: "#F59E0B",
      title: "Practice In Your Own Environment Only",
      subtitle: "Isolated Sandbox & Safe Labs",
      text: "Any tools, techniques, code, or methods demonstrated must ONLY be practiced and tested within your own private, legal, and authorized test environments (e.g. personal lab, local virtual machines). Never target third parties.",
    },
    {
      icon: "alert-circle-outline",
      iconColor: "#EF4444",
      title: "Zero Tolerance for Misuse (Permanent Ban)",
      subtitle: "Strict Safety & Compliance Policy",
      text: "You strictly agree that you will NEVER misuse any course content, tools, or techniques for malicious, illegal, or unethical purposes. If any user is found or reported misusing knowledge gained from this platform, their account will be PERMANENTLY BANNED immediately without warning or refund.",
    },
    {
      icon: "checkmark-circle-outline",
      iconColor: "#06B6D4",
      title: "Curated from Main Sources",
      subtitle: "Top-Tier Learning Material",
      text: "The courses and materials available on Course Arena are carefully curated and collected from primary main sources to bring you the highest quality learning experiences.",
    },
    {
      icon: "shield-checkmark-outline",
      iconColor: "#8B5CF6",
      title: "Personal Responsibility & Liability",
      subtitle: "You Are 100% Accountable",
      text: "By registering and using Course Arena, you acknowledge and agree that you are solely responsible for how you apply any skills or knowledge. The platform creator assumes zero liability for your actions.",
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={[styles.modalCard, { backgroundColor: cardBg }]} edges={["bottom"]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: borderCol }]}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="shield-checkmark" size={26} color="#1769E0" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: textColor }]}>Educational Policy & Terms</Text>
              <Text style={[styles.headerSub, { color: textDimColor }]}>Please read carefully before continuing</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={[styles.closeBtn, { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" }]}
            >
              <Ionicons name="close" size={22} color={textColor} />
            </Pressable>
          </View>

          {/* Notice Banner */}
          <View style={[styles.alertBanner, { backgroundColor: isDark ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7", borderColor: isDark ? "rgba(245, 158, 11, 0.3)" : "#FDE68A" }]}>
            <Ionicons name="warning-outline" size={20} color={isDark ? "#FBBF24" : "#B45309"} />
            <Text style={[styles.alertBannerText, { color: isDark ? "#FCD34D" : "#92400E" }]}>
              Mandatory reading: You must understand and accept our policies before creating an account on Course Arena.
            </Text>
          </View>

          {/* Policy Content Scroll */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            onScroll={({ nativeEvent }) => {
              const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
              const isCloseToBottom =
                layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
              if (isCloseToBottom) {
                setHasScrolledToBottom(true);
              }
            }}
            scrollEventThrottle={200}
          >
            {policySections.map((sec, idx) => (
              <View key={idx} style={[styles.sectionCard, { backgroundColor: sectionBg, borderColor: borderCol }]}>
                <View style={[styles.sectionIconWrap, { backgroundColor: `${sec.iconColor}15` }]}>
                  <Ionicons name={sec.icon as any} size={22} color={sec.iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionTitle, { color: textColor }]}>{sec.title}</Text>
                  <Text style={[styles.sectionSubtitle, { color: textDimColor }]}>{sec.subtitle}</Text>
                  <Text style={[styles.sectionText, { color: isDark ? "#CBD5E1" : "#334155" }]}>{sec.text}</Text>
                </View>
              </View>
            ))}

            <View style={[styles.pledgeCard, { backgroundColor: isDark ? "rgba(99, 102, 241, 0.15)" : "#EFF6FF", borderColor: isDark ? "rgba(99, 102, 241, 0.3)" : "#BFDBFE" }]}>
              <Ionicons name="lock-closed" size={18} color="#818CF8" />
              <Text style={[styles.pledgeText, { color: isDark ? "#C7D2FE" : "#1E40AF" }]}>
                I pledge to use Course Arena strictly for self-learning, defensive understanding, and research in my own authorized sandbox.
              </Text>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={[styles.footer, { borderTopColor: borderCol }]}>
            {showAcceptButton && (
              <Pressable
                style={styles.acceptButton}
                onPress={() => {
                  if (onAccept) onAccept();
                  onClose();
                }}
              >
                <Ionicons name="checkmark-done" size={20} color="#FFFFFF" />
                <Text style={styles.acceptButtonText}>I Understand & Agree</Text>
              </Pressable>
            )}
            <Pressable style={styles.declineButton} onPress={onClose}>
              <Text style={[styles.declineButtonText, { color: textDimColor }]}>Close</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.88,
    minHeight: height * 0.65,
    paddingTop: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    gap: 12,
  },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  headerSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
    gap: 10,
  },
  alertBannerText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    fontWeight: "600",
    lineHeight: 17,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  sectionCard: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 1,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  sectionText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 19,
  },
  pledgeCard: {
    flexDirection: "row",
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  pledgeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#1E40AF",
    lineHeight: 17,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 8 : 16,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    gap: 8,
  },
  acceptButton: {
    flexDirection: "row",
    backgroundColor: "#1769E0",
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  acceptButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  declineButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  declineButtonText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
  },
});
