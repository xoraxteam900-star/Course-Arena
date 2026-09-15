import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
  Dimensions,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import * as Clipboard from "@/utils/clipboard";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  subscribeNotifications,
  deleteNotification,
  clearAllNotifications,
  markRead,
} from "@/services/notifications";
import { AppNotification } from "@/types";

const { width } = Dimensions.get("window");

export default function NotificationsScreen() {
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "unread" | "courses" | "wallet" | "broadcast">("all");
  const [autoDeleteOnRead, setAutoDeleteOnRead] = useState(true);
  const [inspectingItem, setInspectingItem] = useState<AppNotification | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!profile?.uid) {
      setLoading(false);
      return;
    }

    const unsub = subscribeNotifications(profile.uid, (notifs) => {
      setItems(notifs);
      setLoading(false);
    });

    return () => unsub();
  }, [profile?.uid]);

  // Show quick toast banner
  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => {
      setFeedbackToast((prev) => (prev === msg ? null : prev));
    }, 2400);
  };

  // Helper for notification classification and styling
  const getNotificationMeta = useCallback((notif: AppNotification) => {
    const text = `${notif.title} ${notif.message}`.toLowerCase();
    
    if (notif.courseId || text.includes("course") || text.includes("lesson") || text.includes("certificate") || notif.type === "course") {
      return {
        category: "Course",
        icon: "school-outline",
        color: "#6366F1",
        bgColor: "#6366F115",
        actionLabel: "View Course",
        actionRoute: notif.courseId ? `/course/${notif.courseId}` : "/(tabs)",
      };
    }
    if (text.includes("wallet") || text.includes("ghc") || text.includes("deposit") || text.includes("top-up") || text.includes("top up") || text.includes("momo") || text.includes("gift") || notif.type === "wallet") {
      return {
        category: "Wallet",
        icon: "wallet-outline",
        color: "#10B981",
        bgColor: "#10B98115",
        actionLabel: "Open Wallet",
        actionRoute: "/(tabs)/wallet",
      };
    }
    if (text.includes("chat") || text.includes("friend") || text.includes("message") || notif.type === "chat") {
      return {
        category: "Social",
        icon: "chatbubbles-outline",
        color: "#06B6D4",
        bgColor: "#06B6D415",
        actionLabel: "Open Chat",
        actionRoute: "/chat",
      };
    }
    if (notif.promoCode || text.includes("promo") || text.includes("discount") || text.includes("voucher") || notif.type === "promo") {
      return {
        category: "Special Offer",
        icon: "gift-outline",
        color: "#EC4899",
        bgColor: "#EC489915",
        actionLabel: "Redeem Offer",
        actionRoute: "/(tabs)",
      };
    }
    if (text.includes("policy") || text.includes("ban") || text.includes("security") || text.includes("warning") || notif.type === "security") {
      return {
        category: "Security",
        icon: "shield-checkmark-outline",
        color: "#F59E0B",
        bgColor: "#F59E0B15",
        actionLabel: "Review Policy",
        actionRoute: null,
      };
    }
    return {
      category: "Broadcast",
      icon: "megaphone-outline",
      color: "#8B5CF6",
      bgColor: "#8B5CF615",
      actionLabel: notif.actionUrl ? "Open Link" : "Read Details",
      actionRoute: null,
    };
  }, []);

  // Format relative timestamp
  const formatTime = (createdAt: any): string => {
    if (!createdAt) return "Recently";
    const millis = createdAt.toMillis ? createdAt.toMillis() : new Date(createdAt).getTime();
    if (isNaN(millis)) return "Recently";
    const diffSec = Math.floor((Date.now() - millis) / 1000);
    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 172800) return "Yesterday";
    return new Date(millis).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Delete notification instantly
  const handleDelete = async (notif: AppNotification, silent = false) => {
    if (!profile?.uid) return;
    try {
      await deleteNotification(notif, profile.uid);
      if (!silent) showToast("🗑️ Notification removed");
    } catch (e: any) {
      Alert.alert("Error", "Could not delete notification: " + e.message);
    }
  };

  // Handle User Clicking Primary Action or Reading
  const handleItemPress = async (notif: AppNotification) => {
    if (!profile?.uid) return;
    const meta = getNotificationMeta(notif);

    if (autoDeleteOnRead) {
      // User explicitly requested: "make notification deleted after user reads it"
      await handleDelete(notif, true);
      showToast("✓ Read and cleared from inbox");
    } else {
      await markRead(notif.id, profile.uid);
    }

    // Handle deep navigation or action
    if (meta.actionRoute) {
      router.push(meta.actionRoute as any);
    } else if (notif.actionUrl) {
      Linking.openURL(notif.actionUrl).catch(() => {});
    } else {
      setInspectingItem(notif);
    }
  };

  // Handle broadcast action button (link or copy)
  const handleButtonClick = async (btn: { type: "link" | "copy"; value: string; label: string }) => {
    if (btn.type === "link") {
      try {
        await WebBrowser.openBrowserAsync(btn.value);
      } catch {
        Linking.openURL(btn.value).catch(() => {
          Alert.alert("Error", "Could not open link: " + btn.value);
        });
      }
    } else if (btn.type === "copy") {
      await Clipboard.setStringAsync(btn.value);
      showToast(`📋 Copied "${btn.label}" to clipboard!`);
    }
  };

  // Copy notification text or promo code
  const handleCopy = async (notif: AppNotification) => {
    const textToCopy = notif.promoCode ? notif.promoCode : `${notif.title}\n${notif.message}`;
    await Clipboard.setStringAsync(textToCopy);
    setCopiedId(notif.id);
    showToast(notif.promoCode ? `Promo code "${notif.promoCode}" copied!` : "Text copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Share notification
  const handleShare = async (notif: AppNotification) => {
    try {
      await Share.share({
        title: notif.title,
        message: `${notif.title}\n\n${notif.message}\n\nShared via Course Arena`,
      });
    } catch (_) {}
  };

  // Clear All confirmation
  const handleClearAll = () => {
    if (items.length === 0) return;
    Alert.alert(
      "Clear All Notifications?",
      `Are you sure you want to remove all ${items.length} notifications from your inbox? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            if (!profile?.uid) return;
            try {
              await clearAllNotifications(items, profile.uid);
              showToast("🧹 All notifications cleared!");
            } catch (e: any) {
              Alert.alert("Error", "Failed to clear notifications: " + e.message);
            }
          },
        },
      ]
    );
  };

  // Filter and search logic
  const filteredItems = useMemo(() => {
    return items.filter((n) => {
      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = n.title?.toLowerCase().includes(q);
        const matchesMsg = n.message?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesMsg) return false;
      }

      // Tab match
      if (activeFilter === "unread") return !n.read;
      if (activeFilter === "courses") {
        const text = `${n.title} ${n.message}`.toLowerCase();
        return n.courseId || text.includes("course") || text.includes("lesson");
      }
      if (activeFilter === "wallet") {
        const text = `${n.title} ${n.message}`.toLowerCase();
        return text.includes("wallet") || text.includes("ghc") || text.includes("deposit") || text.includes("gift");
      }
      if (activeFilter === "broadcast") return n.targetUserId === null;
      return true;
    });
  }, [items, searchQuery, activeFilter]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      {/* Top Navigation Bar */}
      <View style={[styles.navBar, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.navTitleContainer}>
          <Text style={[styles.navTitle, { color: colors.text }]}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount} new</Text>
            </View>
          )}
        </View>
        {items.length > 0 && (
          <Pressable onPress={handleClearAll} style={styles.clearAllBtn} hitSlop={12}>
            <Ionicons name="trash-bin-outline" size={18} color="#EF4444" />
            <Text style={styles.clearAllText}>Clear</Text>
          </Pressable>
        )}
      </View>

      {/* Toast Banner */}
      {feedbackToast && (
        <View style={styles.toastBanner}>
          <Ionicons name="checkmark-circle" size={18} color="#10B981" />
          <Text style={styles.toastBannerText}>{feedbackToast}</Text>
        </View>
      )}

      {/* Auto-Delete On Read Banner & Toggle */}
      <View style={[styles.autoDeleteCard, { backgroundColor: isDark ? "#1E293B" : "#EFF6FF", borderColor: isDark ? "#334155" : "#BFDBFE" }]}>
        <View style={styles.autoDeleteLeft}>
          <View style={[styles.flashIconWrap, { backgroundColor: autoDeleteOnRead ? "#10B98120" : "#94A3B820" }]}>
            <Ionicons name="flash" size={16} color={autoDeleteOnRead ? "#10B981" : "#94A3B8"} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.autoDeleteTitle, { color: colors.text }]}>Auto-Delete On Read</Text>
            <Text style={[styles.autoDeleteSubtitle, { color: colors.textDim }]}>
              {autoDeleteOnRead
                ? "Notifications automatically clear once opened or acted upon"
                : "Notifications will stay in inbox until manually deleted"}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => {
            const next = !autoDeleteOnRead;
            setAutoDeleteOnRead(next);
            showToast(next ? "⚡ Auto-Delete on read enabled" : "Auto-Delete disabled");
          }}
          style={[
            styles.toggleSwitch,
            { backgroundColor: autoDeleteOnRead ? "#10B981" : colors.border },
          ]}
        >
          <View
            style={[
              styles.toggleKnob,
              { transform: [{ translateX: autoDeleteOnRead ? 18 : 2 }] },
            ]}
          />
        </Pressable>
      </View>

      {/* Search Input */}
      {items.length > 2 && (
        <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.textDim} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search notifications..."
            placeholderTextColor={colors.textDim}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={colors.textDim} />
            </Pressable>
          )}
        </View>
      )}

      {/* Filter Tabs */}
      {items.length > 0 && (
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {(
              [
                { id: "all", label: `All (${items.length})` },
                { id: "unread", label: `Unread (${unreadCount})` },
                { id: "courses", label: "Courses" },
                { id: "wallet", label: "Wallet" },
                { id: "broadcast", label: "Broadcasts" },
              ] as const
            ).map((tab) => {
              const isActive = activeFilter === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isActive ? "#1769E0" : colors.card,
                      borderColor: isActive ? "#1769E0" : colors.border,
                    },
                  ]}
                  onPress={() => setActiveFilter(tab.id)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: isActive ? "#FFFFFF" : colors.textDim },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* List / Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1769E0" />
          <Text style={[styles.loadingText, { color: colors.textDim }]}>Loading notifications...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const meta = getNotificationMeta(item);
            const isUnread = !item.read;

            return (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: isUnread ? `${meta.color}40` : colors.border,
                    borderLeftColor: meta.color,
                    borderLeftWidth: 4,
                  },
                ]}
              >
                {/* Header Row of the Card */}
                <Pressable
                  onPress={() => handleItemPress(item)}
                  style={styles.cardHeaderPressable}
                >
                  <View style={[styles.categoryIconWrap, { backgroundColor: meta.bgColor }]}>
                    <Ionicons name={meta.icon as any} size={20} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.cardTopMeta}>
                      <View style={[styles.categoryPill, { backgroundColor: meta.bgColor }]}>
                        <Text style={[styles.categoryPillText, { color: meta.color }]}>
                          {meta.category}
                        </Text>
                      </View>
                      <Text style={[styles.timeText, { color: colors.textDim }]}>
                        {formatTime(item.createdAt)}
                      </Text>
                      {isUnread && <View style={styles.blueDot} />}
                    </View>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                  </View>
                </Pressable>

                {/* Message Body */}
                <Text style={[styles.cardMessage, { color: colors.textDim }]} numberOfLines={3}>
                  {item.message}
                </Text>

                {/* Promo Code Chip if exists */}
                {item.promoCode && (
                  <Pressable
                    style={styles.promoChip}
                    onPress={() => handleCopy(item)}
                  >
                    <Ionicons name="ticket-outline" size={14} color="#EC4899" />
                    <Text style={styles.promoChipText}>Code: {item.promoCode}</Text>
                    <Ionicons name="copy-outline" size={13} color="#EC4899" style={{ marginLeft: 4 }} />
                  </Pressable>
                )}

                {/* Broadcast Action Buttons if attached */}
                {item.buttons && item.buttons.length > 0 && (
                  <View style={styles.notifButtonsContainer}>
                    {item.buttons.map((btn, idx) => (
                      <Pressable
                        key={btn.id || `btn_${idx}`}
                        style={[
                          styles.notifActionBtn,
                          btn.type === "copy"
                            ? { backgroundColor: isDark ? "rgba(99, 102, 241, 0.15)" : "#EEF2FF", borderColor: "#6366F1", borderWidth: 1 }
                            : { backgroundColor: "#6366F1" },
                        ]}
                        onPress={() => handleButtonClick(btn)}
                      >
                        <Ionicons
                          name={btn.type === "copy" ? "copy-outline" : "open-outline"}
                          size={13}
                          color={btn.type === "copy" ? "#6366F1" : "#FFFFFF"}
                        />
                        <Text
                          style={[
                            styles.notifActionBtnText,
                            { color: btn.type === "copy" ? "#6366F1" : "#FFFFFF" },
                          ]}
                          numberOfLines={1}
                        >
                          {btn.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                {/* Action Bar (Cool Functions Under It) */}
                <View style={[styles.cardActionBar, { borderTopColor: colors.border }]}>
                  {/* Primary Action Button */}
                  <Pressable
                    style={[styles.primaryActionBtn, { backgroundColor: meta.bgColor }]}
                    onPress={() => handleItemPress(item)}
                  >
                    <Text style={[styles.primaryActionText, { color: meta.color }]}>
                      {meta.actionLabel}
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={meta.color} />
                  </Pressable>

                  {/* Secondary Function Icons */}
                  <View style={styles.secondaryActions}>
                    {/* Copy Button */}
                    <Pressable
                      style={styles.actionIconBtn}
                      onPress={() => handleCopy(item)}
                      hitSlop={8}
                    >
                      <Ionicons
                        name={copiedId === item.id ? "checkmark" : "copy-outline"}
                        size={18}
                        color={copiedId === item.id ? "#10B981" : colors.textDim}
                      />
                    </Pressable>

                    {/* Share Button */}
                    <Pressable
                      style={styles.actionIconBtn}
                      onPress={() => handleShare(item)}
                      hitSlop={8}
                    >
                      <Ionicons name="share-social-outline" size={18} color={colors.textDim} />
                    </Pressable>

                    {/* Delete Button */}
                    <Pressable
                      style={[styles.actionIconBtn, styles.deleteIconBtn]}
                      onPress={() => handleDelete(item)}
                      hitSlop={8}
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" }]}>
                <Ionicons name="notifications-off-outline" size={48} color="#1769E0" />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>You're All Caught Up!</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textDim }]}>
                {searchQuery || activeFilter !== "all"
                  ? "No notifications match your current filter."
                  : "All notifications have been read and cleared from your inbox."}
              </Text>
              <View style={styles.emptyActionsRow}>
                <Pressable
                  style={styles.emptyBtn}
                  onPress={() => router.push("/(tabs)")}
                >
                  <Ionicons name="compass-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.emptyBtnText}>Explore Courses</Text>
                </Pressable>
                <Pressable
                  style={[styles.emptyBtnSecondary, { borderColor: colors.border }]}
                  onPress={() => router.push("/(tabs)/wallet")}
                >
                  <Ionicons name="wallet-outline" size={18} color={colors.text} />
                  <Text style={[styles.emptyBtnSecondaryText, { color: colors.text }]}>My Wallet</Text>
                </Pressable>
              </View>
            </View>
          }
        />
      )}

      {/* Notification Reader / Inspector Modal */}
      {inspectingItem && (
        <Modal
          visible={true}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setInspectingItem(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View
                  style={[
                    styles.modalIconWrap,
                    { backgroundColor: getNotificationMeta(inspectingItem).bgColor },
                  ]}
                >
                  <Ionicons
                    name={getNotificationMeta(inspectingItem).icon as any}
                    size={26}
                    color={getNotificationMeta(inspectingItem).color}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalCategory, { color: getNotificationMeta(inspectingItem).color }]}>
                    {getNotificationMeta(inspectingItem).category}
                  </Text>
                  <Text style={[styles.modalTime, { color: colors.textDim }]}>
                    {formatTime(inspectingItem.createdAt)}
                  </Text>
                </View>
                <Pressable onPress={() => setInspectingItem(null)} style={styles.modalCloseBtn} hitSlop={12}>
                  <Ionicons name="close" size={22} color={colors.textDim} />
                </Pressable>
              </View>

              {/* Title & Body */}
              <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingVertical: 12 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{inspectingItem.title}</Text>
                <Text style={[styles.modalBody, { color: colors.textDim }]}>{inspectingItem.message}</Text>

                {/* Broadcast Action Buttons in Modal */}
                {inspectingItem.buttons && inspectingItem.buttons.length > 0 && (
                  <View style={{ marginTop: 14, gap: 8 }}>
                    {inspectingItem.buttons.map((btn, idx) => (
                      <Pressable
                        key={btn.id || `modal_btn_${idx}`}
                        style={[
                          styles.modalBtnRow,
                          btn.type === "copy"
                            ? { backgroundColor: isDark ? "rgba(99, 102, 241, 0.15)" : "#EEF2FF", borderColor: "#6366F1", borderWidth: 1 }
                            : { backgroundColor: "#6366F1" },
                        ]}
                        onPress={() => handleButtonClick(btn)}
                      >
                        <Ionicons
                          name={btn.type === "copy" ? "copy-outline" : "open-outline"}
                          size={16}
                          color={btn.type === "copy" ? "#6366F1" : "#FFFFFF"}
                        />
                        <Text
                          style={[
                            styles.modalBtnRowText,
                            { color: btn.type === "copy" ? "#6366F1" : "#FFFFFF" },
                          ]}
                        >
                          {btn.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </ScrollView>

              {/* Deletion Notice */}
              <View style={styles.modalNotice}>
                <Ionicons name="information-circle" size={16} color="#10B981" />
                <Text style={styles.modalNoticeText}>
                  This notification was read and has been removed from your inbox.
                </Text>
              </View>

              {/* Modal Buttons */}
              <View style={styles.modalActions}>
                {getNotificationMeta(inspectingItem).actionRoute && (
                  <Pressable
                    style={[styles.modalPrimaryBtn, { backgroundColor: "#1769E0" }]}
                    onPress={() => {
                      const route = getNotificationMeta(inspectingItem).actionRoute;
                      setInspectingItem(null);
                      if (route) router.push(route as any);
                    }}
                  >
                    <Text style={styles.modalPrimaryBtnText}>
                      {getNotificationMeta(inspectingItem).actionLabel}
                    </Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                  </Pressable>
                )}
                <Pressable
                  style={[styles.modalCloseActionBtn, { borderColor: colors.border }]}
                  onPress={() => setInspectingItem(null)}
                >
                  <Text style={[styles.modalCloseActionBtnText, { color: colors.text }]}>Close</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
  },
  navTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  unreadBadge: {
    backgroundColor: "#1769E0",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  unreadBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  clearAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  clearAllText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "700",
  },
  toastBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D1FAE5",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    gap: 8,
  },
  toastBannerText: {
    color: "#065F46",
    fontSize: 13,
    fontWeight: "600",
  },
  autoDeleteCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  autoDeleteLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    paddingRight: 10,
  },
  flashIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  autoDeleteTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  autoDeleteSubtitle: {
    fontSize: 11,
    marginTop: 1,
    lineHeight: 15,
  },
  toggleSwitch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: "100%",
  },
  filterRow: {
    marginTop: 10,
    marginBottom: 4,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  listContent: {
    padding: 16,
    paddingBottom: 60,
    gap: 12,
  },
  card: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardHeaderPressable: {
    flexDirection: "row",
    gap: 12,
  },
  categoryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTopMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  timeText: {
    fontSize: 11,
  },
  blueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#1769E0",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  cardMessage: {
    fontSize: 13,
    marginTop: 8,
    lineHeight: 19,
  },
  promoChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#FCE7F3",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 8,
    gap: 4,
  },
  promoChipText: {
    color: "#BE185D",
    fontSize: 12,
    fontWeight: "700",
  },
  cardActionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  primaryActionText: {
    fontSize: 12,
    fontWeight: "700",
  },
  secondaryActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteIconBtn: {
    backgroundColor: "#FEE2E220",
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyActionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1769E0",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
  },
  emptyBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  emptyBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
  },
  emptyBtnSecondaryText: {
    fontWeight: "700",
    fontSize: 13,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: width * 0.9,
    maxHeight: "80%",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 12,
  },
  modalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCategory: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  modalTime: {
    fontSize: 11,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalScroll: {
    maxHeight: 250,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 22,
  },
  modalNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D1FAE5",
    padding: 10,
    borderRadius: 8,
    gap: 8,
    marginVertical: 12,
  },
  modalNoticeText: {
    fontSize: 12,
    color: "#065F46",
    fontWeight: "600",
    flex: 1,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  modalPrimaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderRadius: 10,
    gap: 6,
  },
  modalPrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  modalCloseActionBtn: {
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseActionBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  notifButtonsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  notifActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 6,
  },
  notifActionBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  modalBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
  },
  modalBtnRowText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
