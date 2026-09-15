import React, { useState, useRef, useEffect } from "react";
import { 
  Modal, View, Text, StyleSheet, TextInput, Pressable, 
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Keyboard, Image, Alert, Animated
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "@/firebase/config";
import { Course } from "@/types";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { AI_KNOWLEDGE } from "@/constants/ai_knowledge";

type AiAction = "ask_feedback" | "none";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  courseIds?: string[];
  action?: AiAction;
  imageUrl?: string | null;
  time?: string;
};

const DEFAULT_WELCOME: Message = { 
  id: "1", 
  role: "assistant", 
  content: "Hey! 👋 I'm your Course Arena AI.\nWhat are you looking for today?",
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
};

export default function AiChatModal({ visible, onClose, onStartTour }: { visible: boolean; onClose: () => void; onStartTour?: () => void }) {
  const { colors } = useTheme();
  
  // Premium dark navy theme for AI chat
  const themeColors = {
    background: "#0B101E", // Dark navy
    card: "#172033", // Slightly lighter navy
    border: "rgba(255,255,255,0.08)",
    text: "#FFFFFF",
    textDim: "#94A3B8",
    primary: "#6D28D9",
  };
  
  const [messages, setMessages] = useState<Message[]>([DEFAULT_WELCOME]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  const scrollRef = useRef<ScrollView>(null);
  const [dotAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible && availableCourses.length === 0) {
      const fetchCourses = async () => {
        try {
          const q = query(collection(db, "courses"), where("status", "==", "published"), limit(50));
          const snap = await getDocs(q);
          setAvailableCourses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
        } catch (e) {
          console.error("Failed to fetch courses for AI context", e);
        }
      };
      fetchCourses();
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [visible, messages]);

  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dotAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(dotAnim, { toValue: 0, duration: 500, useNativeDriver: true })
        ])
      ).start();
    } else {
      dotAnim.stopAnimation();
    }
  }, [isLoading, dotAnim]);

  const confirmClearChat = () => {
    Alert.alert(
      "Clear this conversation?",
      "You cannot undo this action.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear Chat", style: "destructive", onPress: () => {
          setMessages([DEFAULT_WELCOME]);
          setSelectedImage(null);
          setInputText("");
        }}
      ]
    );
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
    });
    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleSend = async (customText?: string) => {
    const textToSend = customText ?? inputText.trim();
    if ((!textToSend && !selectedImage) || isLoading) return;
    
    // Client-side quick triggers
    if (textToSend.toLowerCase().includes("bye") || textToSend.toLowerCase().includes("exit")) {
      setInputText("");
      onClose();
      return;
    }

    const currentImage = selectedImage;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: Message = { id: `user-${Date.now()}-${Math.random().toString(36).substring(7)}`, role: "user", content: textToSend, imageUrl: currentImage, time: timeStr };
    setMessages(prev => [...prev, userMsg]);
    setInputText("");
    setSelectedImage(null);
    setIsLoading(true);
    Keyboard.dismiss();

    // Suggest courses locally if they mention courses directly
    if (textToSend.toLowerCase().includes("suggest") && textToSend.toLowerCase().includes("course")) {
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `ai-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          role: "assistant",
          content: "Here are some top courses you might like:",
          courseIds: availableCourses.slice(0, 3).map(c => c.id),
          action: "ask_feedback",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
        setIsLoading(false);
      }, 1000);
      return;
    }

    try {
      let aiMsg: Message = { 
        id: `ai-${Date.now()}-${Math.random().toString(36).substring(7)}`, 
        role: "assistant", 
        content: "I'm not sure how to respond to that, but I'm here to help!",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      const inputLower = textToSend.toLowerCase();

      // Enhanced Local Rule-Based AI Engine
      if (inputLower.includes("find") || inputLower.includes("suggest") || inputLower.includes("recommend") || inputLower.includes("looking for") || inputLower.includes("want to learn")) {
        aiMsg.content = "I found some great courses for you based on what we have available! 📚✨";
        aiMsg.courseIds = availableCourses.slice(0, 3).map(c => c.id);
        aiMsg.action = "ask_feedback";
      } else if (inputLower.includes("buy") || inputLower.includes("purchase") || inputLower.includes("pay") || inputLower.includes("enroll")) {
        aiMsg.content = "To buy a course, simply click 'View Course' on any course card and tap the 'Buy for GH₵' button! If you have a promo code, the discount will be applied automatically.";
      } else if (inputLower.includes("promo") || inputLower.includes("discount") || inputLower.includes("coupon") || inputLower.includes("offer")) {
        aiMsg.content = "Promotional discounts appear as popups on the dashboard. When you claim one, the discounted price will show directly on the course details page!";
      } else if (inputLower.includes("password") || inputLower.includes("reset") || inputLower.includes("login") || inputLower.includes("sign in")) {
        aiMsg.content = "If you're having trouble logging in, make sure you're using the correct email address. You can reset your password from the login screen by tapping 'Forgot Password?'.";
      } else if (inputLower.includes("refund") || inputLower.includes("money back") || inputLower.includes("cancel")) {
        aiMsg.content = "All our courses come with a satisfaction guarantee. If you'd like a refund, please contact our support team at support@coursearena.com within 30 days of your purchase.";
      } else if (inputLower.includes("hello") || inputLower.includes("hi") || inputLower.includes("hey") || inputLower.includes("greetings")) {
        aiMsg.content = "Hello there! 👋 I'm your intelligent Course Arena assistant. How can I assist you with your learning goals today?";
      } else if (inputLower.includes("who are you") || inputLower.includes("what are you") || inputLower.includes("your name")) {
        aiMsg.content = "I'm the Course Arena AI! I'm here to help you navigate the platform, find the perfect courses, and answer any questions you have about our services. 🧠✨";
      } else if (inputLower.includes("free") || inputLower.includes("cost") || inputLower.includes("price")) {
        aiMsg.content = "Course prices vary, but they are all listed in GH₵ (Ghana Cedis). Sometimes we offer massive discounts, so keep an eye out for promotional banners on the home screen!";
      } else {
        aiMsg.content = "That's an interesting question! I'm constantly learning. While I might not have a specific answer for that right now, I can certainly help you find courses, explain payments, or help you navigate Course Arena. What would you like to explore?";
      }

      // Simulate typing delay for natural UX
      setTimeout(() => {
        setMessages(prev => [...prev, aiMsg]);
        setIsLoading(false);
      }, 500);

    } catch (e) {
      setMessages(prev => [...prev, { 
        id: `ai-${Date.now()}-${Math.random().toString(36).substring(7)}`, 
        role: "assistant", 
        content: "Sorry, I ran into a small issue. Please try again! 📡",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
      setIsLoading(false);
    }
  };

  const handleAction = (type: string) => {
    if (type === "feedback_yes") {
      handleSend("Yes, I like these recommendations!");
    } else if (type === "feedback_no") {
      handleSend("Not really, can you suggest something else?");
    }
  };

  const renderCourseCard = (id: string) => {
    const course = availableCourses.find(c => c.id === id);
    if (!course) return null;
    return (
      <View key={id} style={styles.courseRecCard}>
        <Image source={{ uri: course.image || undefined }} style={styles.courseRecImg} resizeMode="cover" />
        <View style={styles.courseRecInfo}>
          <Text style={[styles.courseRecTitle, { color: themeColors.text }]} numberOfLines={1}>{course.title}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 4 }}>
            <Ionicons name="star" size={14} color="#FBBF24" />
            <Text style={{ fontSize: 12, fontWeight: "600", color: themeColors.textDim }}>{course.avgRating?.toFixed(1) || "4.8"}</Text>
            {(course as any).totalReviews ? (
               <Text style={{ fontSize: 12, color: themeColors.textDim }}>({(course as any).totalReviews})</Text>
            ) : null}
          </View>
          <Text style={{ fontSize: 14, fontWeight: "800", color: themeColors.text, marginBottom: 10 }}>GH₵{course.price}</Text>
          <Pressable style={styles.viewCourseBtn} onPress={() => { onClose(); router.push(`/course/${id}`); }}>
            <Text style={styles.viewCourseBtnText}>View Course →</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={[styles.container, { backgroundColor: themeColors.background }]}>
          
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={styles.aiAvatarHeaderRing}>
                <Image source={require("../../assets/images/ai_logo.jpg")} style={{ width: 44, height: 44, borderRadius: 22 }} />
              </View>
              <View>
                <Text style={[styles.title, { color: themeColors.text }]}>Course Arena AI</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981" }} />
                  <Text style={{ color: "#10B981", fontSize: 13, fontWeight: "500" }}>Online</Text>
                </View>
                <Text style={{ color: themeColors.textDim, fontSize: 12, marginTop: 2 }}>Your learning companion</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <Pressable onPress={confirmClearChat} style={styles.headerBtn}>
                <View style={styles.headerIconWrap}>
                  <Ionicons name="trash-outline" size={18} color={themeColors.textDim} />
                </View>
                <Text style={styles.headerBtnText}>Clear chat</Text>
              </Pressable>
              <Pressable onPress={onClose} style={styles.headerBtn}>
                <View style={styles.headerIconWrap}>
                  <Ionicons name="close" size={18} color={themeColors.textDim} />
                </View>
                <Text style={styles.headerBtnText}>Close</Text>
              </Pressable>
            </View>
          </View>
          
          {/* Chat Area */}
          <ScrollView 
            ref={scrollRef}
            style={styles.chatArea}
            contentContainerStyle={{ padding: 16, paddingBottom: 32, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Welcome State (always at top) */}
            <View style={styles.emptyStateContainer}>
              <View style={styles.emptyAvatarGlow}>
                <Image source={require("../../assets/images/ai_logo.jpg")} style={{ width: 72, height: 72, borderRadius: 36 }} />
              </View>
              <Text style={styles.emptyTitle}>How can I help you today?</Text>
              <Text style={styles.emptySubtitle}>
                Ask me about courses, finding something on Course Arena, or how to use the app.
              </Text>
              
              <View style={styles.quickActionsGrid}>
                <Pressable style={styles.gridActionBtn} onPress={() => handleSend("Find me a course")}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Ionicons name="search" size={20} color="#8B5CF6" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.gridActionTitle}>Find a course</Text>
                      <Text style={styles.gridActionSub} numberOfLines={1}>Help me find a course</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={themeColors.textDim} />
                </Pressable>
                
                <Pressable style={styles.gridActionBtn} onPress={() => handleSend("Can you suggest some courses for me?")}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Ionicons name="book" size={20} color="#3B82F6" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.gridActionTitle}>Recommend a course</Text>
                      <Text style={styles.gridActionSub} numberOfLines={1}>Suggest the best for me</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={themeColors.textDim} />
                </Pressable>
                
                <Pressable style={styles.gridActionBtn} onPress={() => handleSend("How do I buy a course?")}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Ionicons name="card" size={20} color="#EC4899" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.gridActionTitle}>Buy a course</Text>
                      <Text style={styles.gridActionSub} numberOfLines={1}>Learn about payments</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={themeColors.textDim} />
                </Pressable>
                
                <Pressable style={styles.gridActionBtn} onPress={() => handleSend("How do promos work?")}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Ionicons name="gift" size={20} color="#10B981" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.gridActionTitle}>Discounts</Text>
                      <Text style={styles.gridActionSub} numberOfLines={1}>How to use promos</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={themeColors.textDim} />
                </Pressable>
              </View>
              
              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Today</Text>
                <View style={styles.dividerLine} />
              </View>
            </View>

            {/* Messages */}
            {messages.map((msg) => (
              <View key={msg.id} style={styles.messageRow}>
                {msg.role === "assistant" && (
                  <View style={styles.miniAvatarContainer}>
                    <Image source={require("../../assets/images/ai_logo.jpg")} style={{ width: 32, height: 32, borderRadius: 16 }} />
                  </View>
                )}
                
                <View style={[
                  styles.messageContentWrap,
                  msg.role === "user" ? styles.userWrap : styles.aiWrap
                ]}>
                  {/* Image attachment */}
                  {msg.imageUrl && (
                    <Image source={{ uri: msg.imageUrl }} style={{ width: 200, height: 200, borderRadius: 16, marginBottom: 8 }} />
                  )}

                  {/* Text Bubble */}
                  {msg.content ? (
                    <View style={[
                      styles.messageBubble, 
                      msg.role === "user" ? [styles.userBubble, { backgroundColor: themeColors.primary }] : [styles.aiBubble, { backgroundColor: themeColors.card }]
                    ]}>
                      <Text style={[styles.messageText, { color: msg.role === "user" ? "#fff" : themeColors.text }]}>
                        {msg.content}
                      </Text>
                    </View>
                  ) : null}

                  {/* Time and Status for User */}
                  {msg.role === "user" && msg.time && (
                    <View style={styles.timeRowUser}>
                      <Text style={styles.timeText}>{msg.time}</Text>
                      <Ionicons name="checkmark-done" size={14} color="#8B5CF6" />
                    </View>
                  )}
                  {/* Time for AI */}
                  {msg.role === "assistant" && msg.time && (
                    <Text style={styles.timeTextAi}>{msg.time}</Text>
                  )}

                  {/* Course Recommendations */}
                  {msg.courseIds && msg.courseIds.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.courseRecContainerHoriz}>
                      {msg.courseIds.map(id => renderCourseCard(id))}
                    </ScrollView>
                  )}

                  {/* Actions */}
                  {msg.action === "ask_feedback" && msg.role === "assistant" && (
                    <View style={[styles.messageBubble, styles.aiBubble, { backgroundColor: themeColors.card, marginTop: 8 }]}>
                      <Text style={[styles.messageText, { color: themeColors.text, marginBottom: 12 }]}>Would you like me to show you how to purchase a course?</Text>
                      <View style={styles.actionRow}>
                        <Pressable style={styles.actionBtnYes} onPress={() => { onClose(); setTimeout(() => onStartTour?.(), 300); }}>
                          <Text style={styles.actionBtnTextWhite}>Yes, show me</Text>
                        </Pressable>
                        <Pressable style={styles.actionBtnNo} onPress={() => handleSend("Not now")}>
                          <Text style={styles.actionBtnText}>Not now</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}

                </View>
              </View>
            ))}

            {isLoading && (
              <View style={styles.messageRow}>
                <View style={styles.miniAvatarContainer}>
                  <Image source={require("../../assets/images/ai_logo.jpg")} style={{ width: 32, height: 32, borderRadius: 16 }} />
                </View>
                <View style={[styles.messageBubble, styles.aiBubble, { backgroundColor: themeColors.card, flexDirection: "row", paddingHorizontal: 16, paddingVertical: 18, gap: 4 }]}>
                  <Animated.View style={[styles.typingDot, { opacity: dotAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }]} />
                  <Animated.View style={[styles.typingDot, { opacity: dotAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }) }]} />
                  <Animated.View style={[styles.typingDot, { opacity: dotAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }]} />
                </View>
              </View>
            )}
          </ScrollView>

          {/* Image Preview (Before Send) */}
          {selectedImage && (
            <View style={{ padding: 12, marginHorizontal: 16, borderRadius: 12, backgroundColor: themeColors.card, flexDirection: "row", alignItems: "center", marginBottom: 8, borderWidth: 1, borderColor: themeColors.border }}>
              <Image source={{ uri: selectedImage }} style={{ width: 60, height: 60, borderRadius: 8 }} />
              <Pressable style={{ marginLeft: 12, backgroundColor: "rgba(255,0,0,0.1)", padding: 6, borderRadius: 12 }} onPress={() => setSelectedImage(null)}>
                <Ionicons name="close" size={20} color="#EF4444" />
              </Pressable>
            </View>
          )}

          {/* Input Area (Floating Composer) */}
          <View style={styles.inputComposerWrap}>
            <Pressable onPress={pickImage} style={styles.composerAddBtn}>
              <Ionicons name="add" size={24} color={themeColors.textDim} />
            </Pressable>
            
            <View style={[styles.composerInputWrap, { borderColor: themeColors.border }]}>
              <TextInput
                style={[styles.composerInput, { color: themeColors.text }]}
                placeholder="Ask me anything..."
                placeholderTextColor={themeColors.textDim}
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={() => handleSend()}
              />
            </View>
            
            <Pressable 
              style={[
                styles.composerSendBtn, 
                { backgroundColor: (inputText.trim() || selectedImage) ? themeColors.primary : "rgba(109, 40, 217, 0.5)" }
              ]} 
              onPress={() => handleSend()}
              disabled={(!inputText.trim() && !selectedImage) || isLoading}
            >
              <Ionicons name="arrow-up" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  container: { height: "94%", borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: "hidden" },
  
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  aiAvatarHeaderRing: { width: 48, height: 48, borderRadius: 24, padding: 2, backgroundColor: "transparent", borderWidth: 1, borderColor: "#8B5CF6", alignItems: "center", justifyContent: "center", shadowColor: "#8B5CF6", shadowOpacity: 0.8, shadowRadius: 10, elevation: 6 },
  title: { fontSize: 16, fontWeight: "700", marginBottom: 2 },
  headerBtn: { alignItems: "center", justifyContent: "center" },
  headerIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  headerBtnText: { fontSize: 10, color: "#94A3B8" },

  chatArea: { flex: 1 },
  
  // Empty State (Welcome Area)
  emptyStateContainer: { alignItems: "center", paddingTop: 20, paddingBottom: 10 },
  emptyAvatarGlow: { width: 76, height: 76, borderRadius: 38, borderWidth: 1, borderColor: "#8B5CF6", alignItems: "center", justifyContent: "center", shadowColor: "#8B5CF6", shadowOpacity: 0.8, shadowRadius: 16, elevation: 10, marginBottom: 20 },
  emptyTitle: { fontSize: 22, fontWeight: "800", color: "#fff", marginBottom: 8, textAlign: "center" },
  emptySubtitle: { fontSize: 13, color: "#94A3B8", textAlign: "center", paddingHorizontal: 20, marginBottom: 24, lineHeight: 20 },
  
  quickActionsGrid: { width: "100%", flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10, marginBottom: 24 },
  gridActionBtn: { width: "48%", backgroundColor: "#121A2F", padding: 12, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  gridActionTitle: { fontSize: 13, fontWeight: "700", color: "#fff", marginBottom: 2 },
  gridActionSub: { fontSize: 11, color: "#94A3B8" },

  dividerRow: { flexDirection: "row", alignItems: "center", width: "100%", marginBottom: 24, paddingHorizontal: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.1)" },
  dividerText: { marginHorizontal: 12, fontSize: 12, color: "#94A3B8" },

  messageRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
  miniAvatarContainer: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: "#8B5CF6", alignItems: "center", justifyContent: "center", marginRight: 10, shadowColor: "#8B5CF6", shadowOpacity: 0.5, shadowRadius: 4, elevation: 2 },
  messageContentWrap: { flex: 1, alignItems: "flex-start" },
  userWrap: { alignItems: "flex-end", marginLeft: 46 },
  aiWrap: { alignItems: "flex-start", marginRight: 46 },
  messageBubble: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16 },
  userBubble: { borderTopRightRadius: 4 },
  aiBubble: { borderTopLeftRadius: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  messageText: { fontSize: 14, lineHeight: 22 },
  
  timeRowUser: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 4, gap: 4 },
  timeText: { fontSize: 11, color: "#94A3B8" },
  timeTextAi: { fontSize: 11, color: "#94A3B8", marginTop: 4, marginLeft: 2 },

  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#94A3B8" },

  courseRecContainerHoriz: { gap: 12, marginTop: 12, paddingBottom: 8 },
  courseRecCard: { width: 220, backgroundColor: "#172033", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  courseRecImg: { width: "100%", height: 120, backgroundColor: "#333" },
  courseRecInfo: { padding: 12 },
  courseRecTitle: { fontSize: 13, fontWeight: "700", marginBottom: 4 },
  viewCourseBtn: { backgroundColor: "#6D28D9", paddingVertical: 8, borderRadius: 8, alignItems: "center", marginTop: 4 },
  viewCourseBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionBtnYes: { backgroundColor: "#6D28D9", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  actionBtnNo: { backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  actionBtnTextWhite: { color: "#fff", fontWeight: "600", fontSize: 13 },
  actionBtnText: { color: "#E2E8F0", fontWeight: "600", fontSize: 13 },

  inputComposerWrap: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, paddingBottom: Platform.OS === "ios" ? 32 : 16, gap: 10, backgroundColor: "transparent" },
  composerAddBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  composerInputWrap: { flex: 1, borderRadius: 24, borderWidth: 1, paddingHorizontal: 16, minHeight: 44, justifyContent: "center", backgroundColor: "transparent" },
  composerInput: { fontSize: 14, paddingVertical: 10, maxHeight: 100 },
  composerSendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", shadowColor: "#6D28D9", shadowOpacity: 0.4, shadowRadius: 6, elevation: 4 },
});
