import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
  Image,
  ActivityIndicator,
  Modal,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { FadeInView } from "@/components/FadeInView";
import {
  listenToUserChats,
  listenToFriends,
  listenToFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  searchUsers,
  sendFriendRequest,
  getOrCreateChat,
  ChatThread,
  FriendItem,
  FriendRequest,
} from "@/services/chatService";
import {
  listenToPlatformFeatures,
  PlatformFeatures,
} from "@/services/platformFeatures";

export default function ChatIndexScreen() {
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();

  const [features, setFeatures] = useState<PlatformFeatures>({
    enableGifting: true,
    enableChat: true,
  });

  const [activeTab, setActiveTab] = useState<"chats" | "friends" | "requests">("chats");
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Add Friend Modal
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingReqUid, setSendingReqUid] = useState<string | null>(null);

  // Subscribe to platform feature toggle
  useEffect(() => {
    const unsub = listenToPlatformFeatures(setFeatures);
    return () => unsub();
  }, []);

  // Listen to threads, friends, requests
  useEffect(() => {
    if (!profile?.uid) return;

    setLoading(true);
    const unsubChats = listenToUserChats(profile.uid, (data) => {
      setThreads(data);
      setLoading(false);
    });

    const unsubFriends = listenToFriends(profile.uid, (data) => {
      setFriends(data);
    });

    const unsubRequests = listenToFriendRequests(profile.uid, (data) => {
      setRequests(data);
    });

    return () => {
      unsubChats();
      unsubFriends();
      unsubRequests();
    };
  }, [profile?.uid]);

  // Search users debounce
  useEffect(() => {
    const clean = searchQuery.trim();
    if (clean.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const users = await searchUsers(clean);
        // Exclude self
        setSearchResults(users.filter((u) => u.uid !== profile?.uid));
      } catch (e) {
        console.log("User search error:", e);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, profile?.uid]);

  // Send friend request
  async function handleSendRequest(targetUser: any) {
    if (!profile) return;
    setSendingReqUid(targetUser.uid);
    try {
      await sendFriendRequest({
        uid: targetUser.uid,
        username: targetUser.username || "learner",
        fullName: targetUser.fullName || targetUser.displayName || targetUser.username,
      });
      Alert.alert("Request Sent", `Friend request sent to @${targetUser.username}!`);
    } catch (err: any) {
      Alert.alert("Could Not Send", err.message || "Request failed.");
    } finally {
      setSendingReqUid(null);
    }
  }

  // Accept request
  async function handleAccept(req: FriendRequest) {
    try {
      await acceptFriendRequest(req);
      Alert.alert("Friend Added! 🎉", `You are now friends with @${req.senderUsername}.`);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to accept.");
    }
  }

  // Reject request
  async function handleReject(req: FriendRequest) {
    try {
      await rejectFriendRequest(req.id);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to reject.");
    }
  }

  // Open Chat with friend
  async function handleStartChat(friend: { uid: string; username: string; fullName?: string; avatar?: string }) {
    try {
      const chatId = await getOrCreateChat(friend);
      router.push({
        pathname: "/chat/[id]",
        params: {
          id: chatId,
          friendUid: friend.uid,
          friendName: friend.fullName || friend.username,
          friendUsername: friend.username,
          friendAvatar: friend.avatar || "",
        },
      });
    } catch (e: any) {
      Alert.alert("Chat Error", e.message || "Could not open chat.");
    }
  }

  // If Admin disabled Chat
  if (!features.enableChat) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={styles.disabledContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color={colors.textDim} style={{ opacity: 0.5 }} />
          <Text style={[styles.disabledTitle, { color: colors.text }]}>Social Chat Unavailable</Text>
          <Text style={[styles.disabledText, { color: colors.textDim }]}>
            Social chat and messaging are currently turned off by the platform administrator.
          </Text>
          <Pressable
            style={[styles.backHomeBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.replace("/(tabs)")}
          >
            <Text style={styles.backHomeText}>Return to Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <FadeInView style={styles.container}>
        {/* TOP BAR / HEADER */}
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              style={[styles.iconButton, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9" }]}
            >
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </Pressable>
            <View>
              <Text style={[styles.headerTitle, { color: colors.text }]}>CourseArena Social</Text>
              <Text style={{ color: "#10B981", fontSize: 11, fontWeight: "600" }}>● Online & Active</Text>
            </View>
          </View>

          <Pressable
            style={[styles.addFriendHeaderBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              setSearchQuery("");
              setSearchResults([]);
              setShowSearchModal(true);
            }}
          >
            <Ionicons name="person-add" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.addFriendText}>Add Friend</Text>
          </Pressable>
        </View>

        {/* TABS (CHATS, FRIENDS, REQUESTS) */}
        <View style={[styles.tabsRow, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F1F5F9" }]}>
          <Pressable
            style={[styles.tab, activeTab === "chats" && [styles.tabActive, { backgroundColor: colors.card }]]}
            onPress={() => setActiveTab("chats")}
          >
            <Ionicons
              name="chatbubble-ellipses"
              size={16}
              color={activeTab === "chats" ? colors.primary : colors.textDim}
            />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === "chats" ? colors.text : colors.textDim },
              ]}
            >
              Chats
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tab, activeTab === "friends" && [styles.tabActive, { backgroundColor: colors.card }]]}
            onPress={() => setActiveTab("friends")}
          >
            <Ionicons
              name="people"
              size={16}
              color={activeTab === "friends" ? colors.primary : colors.textDim}
            />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === "friends" ? colors.text : colors.textDim },
              ]}
            >
              Friends ({friends.length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tab, activeTab === "requests" && [styles.tabActive, { backgroundColor: colors.card }]]}
            onPress={() => setActiveTab("requests")}
          >
            <Ionicons
              name="notifications"
              size={16}
              color={activeTab === "requests" ? colors.primary : colors.textDim}
            />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === "requests" ? colors.text : colors.textDim },
              ]}
            >
              Requests
            </Text>
            {requests.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{requests.length}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* TAB CONTENT */}
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {/* 1. CHATS TAB */}
            {activeTab === "chats" && (
              <FlatList
                data={threads}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingVertical: 12 }}
                renderItem={({ item }) => {
                  const otherUid = item.participantIds.find((uid) => uid !== profile?.uid);
                  const otherInfo = otherUid ? item.participants[otherUid] : null;
                  const otherName = otherInfo?.fullName || otherInfo?.username || "Friend";
                  const otherUsername = otherInfo?.username || "friend";
                  const otherAvatar = otherInfo?.avatar;

                  return (
                    <Pressable
                      style={[styles.threadCard, { backgroundColor: colors.card, shadowColor: colors.shadow }]}
                      onPress={() =>
                        handleStartChat({
                          uid: otherUid || "",
                          username: otherUsername,
                          fullName: otherName,
                          avatar: otherAvatar,
                        })
                      }
                    >
                      <View style={styles.avatarCircle}>
                        {otherAvatar ? (
                          <Image source={{ uri: otherAvatar }} style={styles.avatarImg} />
                        ) : (
                          <Text style={styles.avatarInitial}>
                            {otherName.charAt(0).toUpperCase()}
                          </Text>
                        )}
                        <View style={styles.onlineDot} />
                      </View>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={[styles.threadName, { color: colors.text }]} numberOfLines={1}>
                            {otherName}
                          </Text>
                          <Text style={[styles.threadTime, { color: colors.textDim }]}>
                            {item.lastMessageAt?.toDate
                              ? formatTime(item.lastMessageAt.toDate())
                              : ""}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                          <Text style={[styles.threadLastMsg, { color: colors.textDim }]} numberOfLines={1}>
                            {item.lastSenderId === profile?.uid ? "You: " : ""}
                            {item.lastMessage || "No messages yet"}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyWrap}>
                    <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.textDim} style={{ opacity: 0.4 }} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>No Conversations Yet</Text>
                    <Text style={[styles.emptyDesc, { color: colors.textDim }]}>
                      Search for friends using "Add Friend" above to start chatting with text and videos!
                    </Text>
                  </View>
                }
              />
            )}

            {/* 2. FRIENDS TAB */}
            {activeTab === "friends" && (
              <FlatList
                data={friends}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingVertical: 12 }}
                renderItem={({ item }) => (
                  <View style={[styles.friendCard, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarInitial}>
                        {item.friendFullName.charAt(0).toUpperCase()}
                      </Text>
                      <View style={styles.onlineDot} />
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.threadName, { color: colors.text }]}>
                        {item.friendFullName}
                      </Text>
                      <Text style={[styles.friendHandle, { color: colors.primary }]}>
                        @{item.friendUsername}
                      </Text>
                    </View>

                    <Pressable
                      style={[styles.messageBtn, { backgroundColor: colors.primary }]}
                      onPress={() =>
                        handleStartChat({
                          uid: item.friendId,
                          username: item.friendUsername,
                          fullName: item.friendFullName,
                        })
                      }
                    >
                      <Ionicons name="chatbubble" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.messageBtnText}>Chat</Text>
                    </Pressable>
                  </View>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyWrap}>
                    <Ionicons name="people-outline" size={48} color={colors.textDim} style={{ opacity: 0.4 }} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>No Friends Added</Text>
                    <Text style={[styles.emptyDesc, { color: colors.textDim }]}>
                      Tap "Add Friend" to find other learners by @username!
                    </Text>
                  </View>
                }
              />
            )}

            {/* 3. REQUESTS TAB */}
            {activeTab === "requests" && (
              <FlatList
                data={requests}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingVertical: 12 }}
                renderItem={({ item }) => (
                  <View style={[styles.requestCard, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarInitial}>
                        {item.senderFullName.charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.threadName, { color: colors.text }]}>
                        {item.senderFullName}
                      </Text>
                      <Text style={[styles.friendHandle, { color: colors.primary }]}>
                        @{item.senderUsername}
                      </Text>
                      <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>
                        Wants to connect with you
                      </Text>

                      <View style={styles.reqActionsRow}>
                        <Pressable
                          style={[styles.reqBtn, { backgroundColor: "#10B981" }]}
                          onPress={() => handleAccept(item)}
                        >
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                          <Text style={styles.reqBtnText}>Accept</Text>
                        </Pressable>

                        <Pressable
                          style={[styles.reqBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#E2E8F0" }]}
                          onPress={() => handleReject(item)}
                        >
                          <Ionicons name="close" size={14} color={colors.text} />
                          <Text style={[styles.reqBtnText, { color: colors.text }]}>Decline</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyWrap}>
                    <Ionicons name="mail-unread-outline" size={48} color={colors.textDim} style={{ opacity: 0.4 }} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>No Pending Requests</Text>
                    <Text style={[styles.emptyDesc, { color: colors.textDim }]}>
                      Incoming friend requests will appear here.
                    </Text>
                  </View>
                }
              />
            )}
          </>
        )}

        {/* SEARCH & ADD FRIEND MODAL */}
        <Modal
          visible={showSearchModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSearchModal(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}>
            <View style={[styles.searchModalCard, { backgroundColor: colors.card }]}>
              <View style={styles.searchModalHeader}>
                <Text style={[styles.searchModalTitle, { color: colors.text }]}>Find Friends</Text>
                <Pressable onPress={() => setShowSearchModal(false)} style={{ padding: 4 }}>
                  <Ionicons name="close" size={24} color={colors.textDim} />
                </Pressable>
              </View>

              <View
                style={[
                  styles.searchBar,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons name="search" size={18} color={colors.textDim} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Search by username or name..."
                  placeholderTextColor={colors.textDim}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                  autoCapitalize="none"
                />
                {searching && <ActivityIndicator size="small" color={colors.primary} />}
              </View>

              <ScrollView style={{ marginTop: 12 }}>
                {searchResults.map((user) => {
                  const isAlreadyFriend = friends.some((f) => f.friendId === user.uid);
                  const isReqPending = requests.some((r) => r.senderId === user.uid);

                  return (
                    <View
                      key={user.uid}
                      style={[
                        styles.searchUserItem,
                        { borderColor: colors.border },
                      ]}
                    >
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarInitial}>
                          {(user.fullName || user.username || "U").charAt(0).toUpperCase()}
                        </Text>
                      </View>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.threadName, { color: colors.text }]}>
                          {user.fullName || user.displayName || user.username}
                        </Text>
                        <Text style={[styles.friendHandle, { color: colors.primary }]}>
                          @{user.username || "learner"}
                        </Text>
                      </View>

                      {isAlreadyFriend ? (
                        <View style={styles.badgeAlready}>
                          <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                          <Text style={{ color: "#10B981", fontSize: 12, fontWeight: "700" }}>
                            Friends
                          </Text>
                        </View>
                      ) : isReqPending ? (
                        <Text style={{ color: colors.textDim, fontSize: 12, fontWeight: "600" }}>
                          Pending
                        </Text>
                      ) : (
                        <Pressable
                          style={[
                            styles.addBtn,
                            { backgroundColor: colors.primary },
                          ]}
                          onPress={() => handleSendRequest(user)}
                          disabled={sendingReqUid === user.uid}
                        >
                          {sendingReqUid === user.uid ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Ionicons name="person-add" size={14} color="#FFFFFF" />
                              <Text style={styles.addBtnText}>Add</Text>
                            </>
                          )}
                        </Pressable>
                      )}
                    </View>
                  );
                })}

                {searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && (
                  <View style={{ alignItems: "center", paddingVertical: 30 }}>
                    <Text style={{ color: colors.textDim, fontSize: 14 }}>
                      No users found matching "{searchQuery}".
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </SafeAreaView>
        </Modal>
      </FadeInView>
    </SafeAreaView>
  );
}

function formatTime(date: Date) {
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  addFriendHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addFriendText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },

  tabsRow: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  tabActive: {
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tabText: { fontSize: 13, fontWeight: "700" },
  badge: {
    backgroundColor: "#EF4444",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },

  centerLoading: { flex: 1, justifyContent: "center", alignItems: "center" },

  threadCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    shadowOpacity: 0.04,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarImg: { width: 48, height: 48, borderRadius: 24 },
  avatarInitial: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  threadName: { fontSize: 15, fontWeight: "700" },
  threadTime: { fontSize: 11 },
  threadLastMsg: { fontSize: 13, marginTop: 2 },

  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    shadowOpacity: 0.04,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  friendHandle: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  messageBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  messageBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },

  requestCard: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowOpacity: 0.04,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  reqActionsRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  reqBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  reqBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },

  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", marginTop: 12 },
  emptyDesc: { fontSize: 13, textAlign: "center", marginTop: 6, lineHeight: 18 },

  // Search modal
  searchModalCard: {
    flex: 1,
    marginTop: 60,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  searchModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  searchModalTitle: { fontSize: 18, fontWeight: "800" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15 },
  searchUserItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  badgeAlready: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
  },

  // Disabled state
  disabledContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  disabledTitle: { fontSize: 20, fontWeight: "800", marginTop: 16 },
  disabledText: { fontSize: 14, textAlign: "center", marginTop: 8, lineHeight: 20 },
  backHomeBtn: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  backHomeText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
});
