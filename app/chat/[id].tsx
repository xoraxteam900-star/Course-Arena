import { useState, useEffect, useRef } from "react";
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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { WebView } from "react-native-webview";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  listenToChatMessages,
  sendChatMessage,
  uploadChatMedia,
  ChatMessage,
} from "@/services/chatService";

export default function ChatRoomScreen() {
  const { id, friendName, friendUsername, friendAvatar, friendUid } = useLocalSearchParams<{
    id: string;
    friendName?: string;
    friendUsername?: string;
    friendAvatar?: string;
    friendUid?: string;
  }>();

  const { profile } = useAuth();
  const { colors, isDark } = useTheme();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);

  // Video playback modal
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);

  // Video Link share modal
  const [showVideoLinkModal, setShowVideoLinkModal] = useState(false);
  const [videoLinkInput, setVideoLinkInput] = useState("");
  const [videoLinkCaption, setVideoLinkCaption] = useState("");

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!id) return;
    const unsub = listenToChatMessages(id, (msgs) => {
      setMessages(msgs);
    });
    return () => unsub();
  }, [id]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Send plain text message
  async function handleSendText() {
    const text = inputText.trim();
    if (!text || !id) return;

    setInputText("");
    setSending(true);
    try {
      await sendChatMessage({
        chatId: id,
        text,
      });
    } catch (e: any) {
      Alert.alert("Send Error", e.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  // Pick Video from gallery
  async function handlePickVideo() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      return Alert.alert("Permission needed", "Please grant access to your photo/video library.");
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        const asset = result.assets[0];
        setMediaUploading(true);

        try {
          // Attempt upload to cloud storage
          let mediaUrl = asset.uri;
          try {
            mediaUrl = await uploadChatMedia(asset.uri, "video");
          } catch (uploadErr) {
            console.log("Direct storage upload failed, using local/fallback:", uploadErr);
          }

          await sendChatMessage({
            chatId: id,
            text: "🎥 Shared a video",
            mediaUrl,
            mediaType: "video",
          });
        } catch (err: any) {
          Alert.alert("Upload Failed", err.message || "Could not upload video.");
        } finally {
          setMediaUploading(false);
        }
      }
    } catch (err: any) {
      Alert.alert("Video Picker Error", err.message || "Failed to pick video.");
    }
  }

  // Share Web/Cloud Video Link (YouTube, MP4, etc.)
  async function handleSendVideoLink() {
    const url = videoLinkInput.trim();
    if (!url) {
      return Alert.alert("Required", "Please enter a valid video link.");
    }

    setShowVideoLinkModal(false);
    setSending(true);
    try {
      await sendChatMessage({
        chatId: id,
        text: videoLinkCaption.trim() || "🎥 Video link",
        mediaUrl: url,
        mediaType: "video",
      });
      setVideoLinkInput("");
      setVideoLinkCaption("");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to send video link.");
    } finally {
      setSending(false);
    }
  }

  // Generate HTML for video playback inside WebView
  function getVideoHtml(url: string) {
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      const videoId = url.includes("v=") ? url.split("v=")[1]?.split("&")[0] : url.split("/").pop();
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { margin: 0; background-color: #000; display: flex; align-items: center; justify-content: center; height: 100vh; }
            iframe { width: 100%; height: 100%; border: none; }
          </style>
        </head>
        <body>
          <iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1" allow="autoplay; fullscreen" allowfullscreen></iframe>
        </body>
        </html>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { margin: 0; background-color: #000; display: flex; align-items: center; justify-content: center; height: 100vh; }
          video { width: 100%; max-height: 100vh; outline: none; }
        </style>
      </head>
      <body>
        <video src="${url}" controls autoplay playsinline></video>
      </body>
      </html>
    `;
  }

  const displayName = friendName || friendUsername || "Friend";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? "#0B141B" : "#EFEAE2" }}>
      {/* WHATSAPP-STYLE HEADER */}
      <View style={[styles.header, { backgroundColor: isDark ? "#1F2C34" : "#075E54" }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </Pressable>

          <View style={styles.headerAvatarCircle}>
            {friendAvatar ? (
              <Image source={{ uri: friendAvatar }} style={styles.headerAvatar} />
            ) : (
              <Text style={styles.headerAvatarInitial}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            )}
            <View style={styles.headerOnlineDot} />
          </View>

          <View>
            <Text style={styles.headerName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.headerStatus}>
              {friendUsername ? `@${friendUsername} • online` : "online"}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <Pressable
            hitSlop={8}
            onPress={() => {
              setVideoLinkInput("");
              setVideoLinkCaption("");
              setShowVideoLinkModal(true);
            }}
          >
            <Ionicons name="videocam" size={22} color="#FFFFFF" />
          </Pressable>
          <Pressable
            hitSlop={8}
            onPress={() =>
              Alert.alert(
                displayName,
                `Friend handle: @${friendUsername || "friend"}\nChat is end-to-end encrypted.`
              )
            }
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* MESSAGES LIST */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 14, paddingBottom: 20 }}
          renderItem={({ item }) => {
            const isMine = item.senderId === profile?.uid;

            return (
              <View
                style={[
                  styles.messageBubbleRow,
                  isMine ? styles.messageMineRow : styles.messageFriendRow,
                ]}
              >
                <View
                  style={[
                    styles.messageBubble,
                    isMine
                      ? [styles.bubbleMine, { backgroundColor: isDark ? "#005C4B" : "#D9FDD3" }]
                      : [styles.bubbleFriend, { backgroundColor: isDark ? "#1F2C34" : "#FFFFFF" }],
                  ]}
                >
                  {/* VIDEO MESSAGE PREVIEW */}
                  {item.mediaType === "video" && item.mediaUrl && (
                    <Pressable
                      style={[
                        styles.videoCard,
                        { backgroundColor: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.06)" },
                      ]}
                      onPress={() => setActiveVideoUrl(item.mediaUrl!)}
                    >
                      <View style={styles.videoPlayCircle}>
                        <Ionicons name="play" size={24} color="#FFFFFF" />
                      </View>
                      <View style={{ marginLeft: 10, flex: 1 }}>
                        <Text
                          style={[
                            styles.videoTitle,
                            { color: isMine ? (isDark ? "#FFFFFF" : "#111B21") : isDark ? "#FFFFFF" : "#111B21" },
                          ]}
                          numberOfLines={1}
                        >
                          Video Message
                        </Text>
                        <Text
                          style={[
                            styles.videoSub,
                            { color: isMine ? (isDark ? "rgba(255,255,255,0.7)" : "#667781") : isDark ? "rgba(255,255,255,0.7)" : "#667781" },
                          ]}
                        >
                          Tap to watch video
                        </Text>
                      </View>
                    </Pressable>
                  )}

                  {/* MESSAGE TEXT */}
                  {item.text ? (
                    <Text
                      style={[
                        styles.messageText,
                        {
                          color: isMine
                            ? isDark
                              ? "#E9EDEF"
                              : "#111B21"
                            : isDark
                            ? "#E9EDEF"
                            : "#111B21",
                        },
                      ]}
                    >
                      {item.text}
                    </Text>
                  ) : null}

                  {/* TIMESTAMP & DOUBLE CHECKMARK */}
                  <View style={styles.timestampRow}>
                    <Text
                      style={[
                        styles.timestampText,
                        {
                          color: isMine
                            ? isDark
                              ? "rgba(233, 237, 239, 0.6)"
                              : "rgba(17, 27, 33, 0.6)"
                            : isDark
                            ? "rgba(233, 237, 239, 0.6)"
                            : "rgba(17, 27, 33, 0.6)",
                        },
                      ]}
                    >
                      {item.createdAt?.toDate
                        ? item.createdAt.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "Just now"}
                    </Text>
                    {isMine && (
                      <Ionicons
                        name="checkmark-done"
                        size={14}
                        color={isDark ? "#53BDEB" : "#53BDEB"}
                        style={{ marginLeft: 3 }}
                      />
                    )}
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.chatEmpty}>
              <View
                style={[
                  styles.encryptionBadge,
                  { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#FDF8E4" },
                ]}
              >
                <Ionicons name="lock-closed" size={13} color="#F59E0B" />
                <Text style={styles.encryptionText}>
                  Messages are end-to-end encrypted with your friend.
                </Text>
              </View>
              <Text style={[styles.chatStartText, { color: isDark ? "#8696A0" : "#667781" }]}>
                Say hello to @{friendUsername || "friend"}! You can share messages and videos.
              </Text>
            </View>
          }
        />

        {/* UPLOADING LOADER BANNER */}
        {mediaUploading && (
          <View style={[styles.uploadBanner, { backgroundColor: isDark ? "#1F2C34" : "#FFFFFF" }]}>
            <ActivityIndicator size="small" color="#075E54" />
            <Text style={{ color: colors.text, fontSize: 13, marginLeft: 8, fontWeight: "600" }}>
              Uploading video message...
            </Text>
          </View>
        )}

        {/* INPUT BAR (WHATSAPP STYLE) */}
        <View
          style={[
            styles.inputContainer,
            { backgroundColor: isDark ? "#1F2C34" : "#F0F2F5" },
          ]}
        >
          {/* VIDEO / MEDIA PICKER BUTTON */}
          <Pressable
            style={styles.attachBtn}
            onPress={handlePickVideo}
            disabled={mediaUploading}
            hitSlop={6}
          >
            <Ionicons name="videocam-outline" size={24} color={isDark ? "#8696A0" : "#54656F"} />
          </Pressable>

          <Pressable
            style={styles.attachBtn}
            onPress={() => {
              setVideoLinkInput("");
              setVideoLinkCaption("");
              setShowVideoLinkModal(true);
            }}
            hitSlop={6}
          >
            <Ionicons name="link-outline" size={24} color={isDark ? "#8696A0" : "#54656F"} />
          </Pressable>

          {/* TEXT INPUT FIELD */}
          <View
            style={[
              styles.inputBox,
              {
                backgroundColor: isDark ? "#2A3942" : "#FFFFFF",
              },
            ]}
          >
            <TextInput
              style={[styles.inputField, { color: isDark ? "#E9EDEF" : "#111B21" }]}
              placeholder="Type a message..."
              placeholderTextColor={isDark ? "#8696A0" : "#8696A0"}
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
          </View>

          {/* SEND BUTTON */}
          <Pressable
            style={[
              styles.sendBtn,
              {
                backgroundColor: isDark ? "#00A884" : "#075E54",
              },
            ]}
            onPress={handleSendText}
            disabled={sending || !inputText.trim()}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={18} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* FULLSCREEN INLINE VIDEO PLAYER MODAL */}
      <Modal
        visible={!!activeVideoUrl}
        animationType="fade"
        onRequestClose={() => setActiveVideoUrl(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#000000" }}>
          <View style={styles.videoPlayerHeader}>
            <Pressable onPress={() => setActiveVideoUrl(null)} style={{ padding: 6 }}>
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.videoPlayerTitle}>Video Player</Text>
            <View style={{ width: 38 }} />
          </View>

          {activeVideoUrl && (
            <WebView
              source={{ html: getVideoHtml(activeVideoUrl) }}
              style={{ flex: 1, backgroundColor: "#000000" }}
              javaScriptEnabled
              domStorageEnabled
              allowsFullscreenVideo
              startInLoadingState
              onError={() => {}}
              renderError={() => (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      backgroundColor: "#000000",
                      justifyContent: "center",
                      alignItems: "center",
                      padding: 24,
                      zIndex: 10,
                    },
                  ]}
                >
                  <Ionicons name="alert-circle-outline" size={48} color="#EF4444" style={{ marginBottom: 12 }} />
                  <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700", marginBottom: 6, textAlign: "center" }}>
                    Unable to load video
                  </Text>
                  <Text style={{ color: "#94A3B8", fontSize: 13, textAlign: "center", marginBottom: 20 }}>
                    The video source could not be resolved or reached.
                  </Text>
                  <Pressable
                    style={{ backgroundColor: "#00A884", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 }}
                    onPress={() => setActiveVideoUrl(null)}
                  >
                    <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 14 }}>Close</Text>
                  </Pressable>
                </View>
              )}
              renderLoading={() => (
                <View style={styles.videoPlayerLoading}>
                  <ActivityIndicator size="large" color="#00A884" />
                </View>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* SHARE VIDEO LINK MODAL */}
      <Modal
        visible={showVideoLinkModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVideoLinkModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
          <View style={[styles.linkModalCard, { backgroundColor: colors.card }]}>
            <View style={styles.linkModalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="videocam" size={20} color="#00A884" />
                <Text style={[styles.linkModalTitle, { color: colors.text }]}>Share Video Link</Text>
              </View>
              <Pressable onPress={() => setShowVideoLinkModal(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color={colors.textDim} />
              </Pressable>
            </View>

            <Text style={{ color: colors.textDim, fontSize: 13, marginBottom: 8 }}>
              Enter a direct video URL (MP4, YouTube, Vimeo, or Google Drive) to play directly in chat:
            </Text>

            <TextInput
              style={[
                styles.linkInput,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="https://..."
              placeholderTextColor={colors.textDim}
              autoCapitalize="none"
              value={videoLinkInput}
              onChangeText={setVideoLinkInput}
            />

            <TextInput
              style={[
                styles.linkInput,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                  marginTop: 10,
                },
              ]}
              placeholder="Optional message caption..."
              placeholderTextColor={colors.textDim}
              value={videoLinkCaption}
              onChangeText={setVideoLinkCaption}
            />

            <Pressable
              style={[styles.sendLinkBtn, { backgroundColor: "#00A884" }]}
              onPress={handleSendVideoLink}
            >
              <Ionicons name="send" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>
                Send Video Message
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backBtn: { padding: 4 },
  headerAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  headerAvatarInitial: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  headerOnlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#25D366",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  headerName: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  headerStatus: { color: "rgba(255,255,255,0.8)", fontSize: 11 },

  messageBubbleRow: {
    flexDirection: "row",
    marginVertical: 4,
  },
  messageMineRow: { justifyContent: "flex-end" },
  messageFriendRow: { justifyContent: "flex-start" },
  messageBubble: {
    maxWidth: "80%",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    elevation: 1,
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  bubbleMine: {
    borderTopRightRadius: 2,
  },
  bubbleFriend: {
    borderTopLeftRadius: 2,
  },
  messageText: { fontSize: 15, lineHeight: 20 },
  timestampRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  timestampText: { fontSize: 10 },

  // Video message card
  videoCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  videoPlayCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#00A884",
    alignItems: "center",
    justifyContent: "center",
  },
  videoTitle: { fontSize: 14, fontWeight: "700" },
  videoSub: { fontSize: 11, marginTop: 2 },

  chatEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  encryptionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  encryptionText: { fontSize: 12, color: "#856404", fontWeight: "600" },
  chatStartText: { fontSize: 14, textAlign: "center", lineHeight: 20 },

  uploadBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.1)",
  },

  // Input bar
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
  },
  attachBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  inputBox: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    maxHeight: 100,
  },
  inputField: { fontSize: 15, minHeight: 28, maxHeight: 80 },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  // Video player modal
  videoPlayerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#111B21",
  },
  videoPlayerTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  videoPlayerLoading: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },

  // Link modal
  linkModalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  linkModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  linkModalTitle: { fontSize: 17, fontWeight: "700" },
  linkInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  sendLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 16,
  },
});
