import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Switch, ActivityIndicator, Alert, ScrollView, Pressable, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { getNavbarConfig, saveNavbarConfig, IosNavbarTemplate, AndroidNavbarTemplate, NavbarConfig } from "@/services/navbarSettings";
import { 
  getCourseBoxConfig, 
  saveCourseBoxConfig, 
  CourseBoxConfig, 
  CourseBoxPreset, 
  COURSE_BOX_PRESETS, 
  defaultCourseBoxConfig 
} from "@/services/dashboardSettings";
import {
  getPlatformFeatures,
  savePlatformFeatures,
  PlatformFeaturesConfig,
  defaultPlatformFeatures,
} from "@/services/platformFeatures";

const IOS_TEMPLATES: { id: IosNavbarTemplate, label: string }[] = [
  { id: "ios-pill", label: "Classic Pill (Floating)" },
  { id: "ios-island", label: "Dynamic Island" },
  { id: "ios-minimal", label: "Minimalist Clear" }
];

const ANDROID_TEMPLATES: { id: AndroidNavbarTemplate, label: string }[] = [
  { id: "android-unified", label: "Unified Glow" },
  { id: "android-flat", label: "Modern Flat" },
  { id: "android-floating", label: "Floating Capsule" }
];

const PRESET_OPTIONS: { id: Exclude<CourseBoxPreset, "custom">; label: string; desc: string; icon: any }[] = [
  { id: "compact", label: "Compact", desc: "160px • Space-saving", icon: "phone-portrait-outline" },
  { id: "standard", label: "Standard", desc: "200px • Default", icon: "tablet-portrait-outline" },
  { id: "large", label: "Large", desc: "245px • Prominent", icon: "tv-outline" },
  { id: "hero", label: "Showcase", desc: "290px • Hero size", icon: "sparkles-outline" },
];

export default function AdminSettings() {
  const { profile } = useAuth();
  const [aiEnabled, setAiEnabled] = useState(false);
  const [navConfig, setNavConfig] = useState<NavbarConfig | null>(null);
  const [boxConfig, setBoxConfig] = useState<CourseBoxConfig>(defaultCourseBoxConfig);
  const [features, setFeatures] = useState<PlatformFeaturesConfig>(defaultPlatformFeatures);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedStatus, setSavedStatus] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem("@admin_ai_description_enabled"),
      getNavbarConfig(),
      getCourseBoxConfig(),
      getPlatformFeatures(),
    ]).then(([aiVal, navVal, boxVal, featVal]) => {
      setAiEnabled(aiVal === "true");
      setNavConfig(navVal);
      setBoxConfig(boxVal);
      setFeatures(featVal);
    }).finally(() => setLoading(false));
  }, []);

  const toggleGifting = async (val: boolean) => {
    const updated = { ...features, enableGifting: val };
    setFeatures(updated);
    try {
      await savePlatformFeatures({ enableGifting: val });
      showSavedIndicator(val ? "Gifting feature enabled!" : "Gifting feature disabled!");
    } catch (e) {
      Alert.alert("Error", "Failed to update gifting feature");
      setFeatures(features);
    }
  };

  const toggleChat = async (val: boolean) => {
    const updated = { ...features, enableChat: val };
    setFeatures(updated);
    try {
      await savePlatformFeatures({ enableChat: val });
      showSavedIndicator(val ? "Friends & Chat feature enabled!" : "Friends & Chat feature disabled!");
    } catch (e) {
      Alert.alert("Error", "Failed to update chat feature");
      setFeatures(features);
    }
  };

  const showSavedIndicator = (msg: string = "Changes saved live!") => {
    setSavedStatus(msg);
    setTimeout(() => {
      setSavedStatus(null);
    }, 3000);
  };

  const toggleAi = async (val: boolean) => {
    setAiEnabled(val);
    try {
      await AsyncStorage.setItem("@admin_ai_description_enabled", val ? "true" : "false");
      showSavedIndicator("AI setting updated!");
    } catch (e) {
      Alert.alert("Error", "Failed to save settings");
      setAiEnabled(!val);
    }
  };

  const handleUpdateNav = async (os: "ios" | "android", templateId: string) => {
    if (!navConfig) return;
    const newConfig = {
      ...navConfig,
      ...(os === "ios" ? { iosTemplate: templateId as IosNavbarTemplate } : { androidTemplate: templateId as AndroidNavbarTemplate })
    };
    
    setNavConfig(newConfig);
    setSaving(true);
    try {
      await saveNavbarConfig(newConfig);
      showSavedIndicator("Navbar template updated!");
    } catch (e) {
      Alert.alert("Error", "Failed to update navbar template for users");
    } finally {
      setSaving(false);
    }
  };

  // Select a course card preset
  const handleSelectBoxPreset = async (presetId: Exclude<CourseBoxPreset, "custom">) => {
    const preset = COURSE_BOX_PRESETS[presetId];
    const updated: CourseBoxConfig = {
      ...boxConfig,
      ...preset,
    };
    setBoxConfig(updated);
    setSaving(true);
    try {
      await saveCourseBoxConfig(updated);
      showSavedIndicator(`Box size updated to ${presetId.toUpperCase()}!`);
    } catch (e) {
      Alert.alert("Error", "Failed to update dashboard course box size");
    } finally {
      setSaving(false);
    }
  };

  // Adjust dimension with steppers
  const handleAdjustDimension = async (field: "cardWidth" | "imageHeight" | "borderRadius", delta: number) => {
    let min = 140;
    let max = 320;
    if (field === "imageHeight") {
      min = 65;
      max = 200;
    } else if (field === "borderRadius") {
      min = 6;
      max = 28;
    }

    const currentVal = boxConfig[field];
    const newVal = Math.min(Math.max(currentVal + delta, min), max);
    if (newVal === currentVal) return;

    const updated: CourseBoxConfig = {
      ...boxConfig,
      [field]: newVal,
      preset: "custom",
    };

    setBoxConfig(updated);
    try {
      await saveCourseBoxConfig(updated);
      showSavedIndicator();
    } catch (e) {
      console.warn("Failed to auto-save dimension:", e);
    }
  };

  // Reset to default (Standard 200 x 100)
  const handleResetBoxConfig = async () => {
    const updated = { ...defaultCourseBoxConfig };
    setBoxConfig(updated);
    setSaving(true);
    try {
      await saveCourseBoxConfig(updated);
      showSavedIndicator("Reset to default (Standard 240 × 130)!");
    } catch (e) {
      Alert.alert("Error", "Failed to reset course box size");
    } finally {
      setSaving(false);
    }
  };

  if (profile?.role !== "admin") {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.denied}>Admin access only.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerTitleRow}>
        <Text style={styles.title}>Admin Settings</Text>
        {savedStatus && (
          <View style={styles.liveSavedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
            <Text style={styles.liveSavedText}>{savedStatus}</Text>
          </View>
        )}
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.settingsList} showsVerticalScrollIndicator={false}>

          {/* SOCIAL & WALLET FEATURE TOGGLES */}
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.settingIconWrap, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
              <Ionicons name="gift-outline" size={20} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionHeading}>Social & Wallet Features</Text>
              <Text style={styles.sectionDesc}>Enable or disable user wallet gifting and friends chat across the entire platform in real-time.</Text>
            </View>
          </View>

          {/* GIFT A FRIEND TOGGLE */}
          <View style={[styles.settingRow, { marginTop: 8 }]}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIconWrap, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
                <Ionicons name="gift" size={18} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>Gift a Friend (Wallet Transfer)</Text>
                <Text style={styles.settingSub}>Allow students to send money gifts directly to friends by username.</Text>
              </View>
            </View>
            <Switch
              value={features.enableGifting}
              onValueChange={toggleGifting}
              trackColor={{ false: "#1E293B", true: "#10B981" }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* FRIENDS & CHAT TOGGLE */}
          <View style={[styles.settingRow, { marginTop: 12 }]}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIconWrap, { backgroundColor: "rgba(99, 102, 241, 0.15)" }]}>
                <Ionicons name="chatbubbles" size={18} color="#6366F1" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>Friends & Social Chat (Text & Video)</Text>
                <Text style={styles.settingSub}>Enable friend requests, 1-on-1 direct messaging, and video sharing between learners.</Text>
              </View>
            </View>
            <Switch
              value={features.enableChat}
              onValueChange={toggleChat}
              trackColor={{ false: "#1E293B", true: "#6366F1" }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.divider} />
          
          {/* AI Auto-Description */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={styles.settingIconWrap}>
                <Ionicons name="sparkles" size={20} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>AI Auto-Description</Text>
                <Text style={styles.settingSub}>Automatically generate course descriptions using AI when creating new courses.</Text>
              </View>
            </View>
            <Switch 
              value={aiEnabled} 
              onValueChange={toggleAi} 
              trackColor={{ false: "#1E293B", true: "#6366F1" }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.divider} />

          {/* DASHBOARD COURSE BOX SIZE EDITOR */}
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.settingIconWrap, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
              <Ionicons name="cube-outline" size={20} color="#38BDF8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionHeading}>Dashboard Course Box Size</Text>
              <Text style={styles.sectionDesc}>Customize the card width, thumbnail height, and styling of courses displayed on the main dashboard in real-time.</Text>
            </View>
          </View>

          {/* LIVE PREVIEW CARD */}
          <View style={styles.previewContainer}>
            <View style={styles.previewHeader}>
              <View style={styles.previewBadge}>
                <Text style={styles.previewBadgeText}>LIVE PREVIEW</Text>
              </View>
              <Text style={styles.dimensionsBadgeText}>
                {boxConfig.cardWidth}px width • {boxConfig.imageHeight}px height
              </Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewScroll}>
              <View 
                style={[
                  styles.previewCard, 
                  { 
                    width: boxConfig.cardWidth, 
                    borderRadius: boxConfig.borderRadius 
                  }
                ]}
              >
                <View style={styles.previewImageContainer}>
                  <Image 
                    source={{ uri: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=400&auto=format&fit=crop" }} 
                    style={[
                      styles.previewImage, 
                      { 
                        height: boxConfig.imageHeight, 
                        borderRadius: Math.max(boxConfig.borderRadius - 4, 6) 
                      }
                    ]} 
                  />
                  <View style={styles.popularBadge}>
                    <Text style={{ fontSize: 10 }}>🔥</Text>
                    <Text style={styles.popularBadgeText}>Popular</Text>
                  </View>
                </View>

                <Text 
                  style={[styles.previewTitle, { fontSize: boxConfig.titleFontSize }]} 
                  numberOfLines={1}
                >
                  React Native & AI Mastery
                </Text>

                <View style={styles.previewFooter}>
                  <View>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                      <Ionicons name="star" size={11} color="#FBBF24" />
                      <Text style={styles.ratingText}>
                        {" "}4.9 <Text style={{ color: "#64748B" }}>(128)</Text>
                      </Text>
                    </View>
                    <Text style={[styles.priceText, { fontSize: boxConfig.priceFontSize }]}>GH₵150.00</Text>
                  </View>
                  <View style={{ padding: 4 }}>
                    <Ionicons name="bookmark" size={18} color="#6366F1" />
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>

          {/* SIZE PRESETS */}
          <Text style={[styles.subHeading, { marginTop: 4 }]}>Quick Size Presets</Text>
          <View style={styles.presetGrid}>
            {PRESET_OPTIONS.map((p) => {
              const isSelected = boxConfig.preset === p.id;
              return (
                <Pressable
                  key={p.id}
                  style={[styles.presetCard, isSelected && styles.presetCardActive]}
                  onPress={() => handleSelectBoxPreset(p.id)}
                >
                  <View style={[styles.presetIconWrap, isSelected && styles.presetIconWrapActive]}>
                    <Ionicons name={p.icon} size={18} color={isSelected ? "#38BDF8" : "#94A3B8"} />
                  </View>
                  <Text style={[styles.presetLabel, isSelected && styles.presetLabelActive]}>{p.label}</Text>
                  <Text style={styles.presetDesc}>{p.desc}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* FINE-TUNING DIMENSION CONTROLS */}
          <Text style={[styles.subHeading, { marginTop: 12 }]}>Fine-Tune Dimensions</Text>
          
          <View style={styles.stepperGroup}>
            {/* Card Width */}
            <View style={styles.stepperRow}>
              <View style={styles.stepperLabelWrap}>
                <Text style={styles.stepperLabel}>Card Width</Text>
                <Text style={styles.stepperSub}>Overall box width (140 - 320 px)</Text>
              </View>
              <View style={styles.stepperControls}>
                <Pressable 
                  style={[styles.stepperBtn, boxConfig.cardWidth <= 140 && styles.stepperBtnDisabled]} 
                  onPress={() => handleAdjustDimension("cardWidth", -10)}
                  disabled={boxConfig.cardWidth <= 140}
                >
                  <Ionicons name="remove" size={18} color="#fff" />
                </Pressable>
                <View style={styles.stepperValueBox}>
                  <Text style={styles.stepperValueText}>{boxConfig.cardWidth} px</Text>
                </View>
                <Pressable 
                  style={[styles.stepperBtn, boxConfig.cardWidth >= 320 && styles.stepperBtnDisabled]} 
                  onPress={() => handleAdjustDimension("cardWidth", 10)}
                  disabled={boxConfig.cardWidth >= 320}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                </Pressable>
              </View>
            </View>

            {/* Image Height */}
            <View style={styles.stepperRow}>
              <View style={styles.stepperLabelWrap}>
                <Text style={styles.stepperLabel}>Image Height</Text>
                <Text style={styles.stepperSub}>Thumbnail height (65 - 200 px)</Text>
              </View>
              <View style={styles.stepperControls}>
                <Pressable 
                  style={[styles.stepperBtn, boxConfig.imageHeight <= 65 && styles.stepperBtnDisabled]} 
                  onPress={() => handleAdjustDimension("imageHeight", -5)}
                  disabled={boxConfig.imageHeight <= 65}
                >
                  <Ionicons name="remove" size={18} color="#fff" />
                </Pressable>
                <View style={styles.stepperValueBox}>
                  <Text style={styles.stepperValueText}>{boxConfig.imageHeight} px</Text>
                </View>
                <Pressable 
                  style={[styles.stepperBtn, boxConfig.imageHeight >= 200 && styles.stepperBtnDisabled]} 
                  onPress={() => handleAdjustDimension("imageHeight", 5)}
                  disabled={boxConfig.imageHeight >= 200}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                </Pressable>
              </View>
            </View>

            {/* Corner Radius */}
            <View style={styles.stepperRow}>
              <View style={styles.stepperLabelWrap}>
                <Text style={styles.stepperLabel}>Corner Radius</Text>
                <Text style={styles.stepperSub}>Border curve (6 - 28 px)</Text>
              </View>
              <View style={styles.stepperControls}>
                <Pressable 
                  style={[styles.stepperBtn, boxConfig.borderRadius <= 6 && styles.stepperBtnDisabled]} 
                  onPress={() => handleAdjustDimension("borderRadius", -2)}
                  disabled={boxConfig.borderRadius <= 6}
                >
                  <Ionicons name="remove" size={18} color="#fff" />
                </Pressable>
                <View style={styles.stepperValueBox}>
                  <Text style={styles.stepperValueText}>{boxConfig.borderRadius} px</Text>
                </View>
                <Pressable 
                  style={[styles.stepperBtn, boxConfig.borderRadius >= 28 && styles.stepperBtnDisabled]} 
                  onPress={() => handleAdjustDimension("borderRadius", 2)}
                  disabled={boxConfig.borderRadius >= 28}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                </Pressable>
              </View>
            </View>
          </View>

          {/* Reset button */}
          <Pressable style={styles.resetBtn} onPress={handleResetBoxConfig}>
            <Ionicons name="refresh-outline" size={16} color="#94A3B8" />
            <Text style={styles.resetBtnText}>Reset to Default (Standard 240 × 130)</Text>
          </Pressable>

          <View style={styles.divider} />
          
          {/* iOS Live Navbar Template */}
          <Text style={styles.sectionHeading}>iOS Live Navbar Template</Text>
          <Text style={styles.sectionDesc}>Changes applied here will instantly notify active iOS users to refresh their layout.</Text>
          
          <View style={styles.cardGroup}>
            {IOS_TEMPLATES.map(t => (
              <Pressable 
                key={t.id}
                style={[styles.templateCard, navConfig?.iosTemplate === t.id && styles.templateCardActive]}
                onPress={() => handleUpdateNav("ios", t.id)}
              >
                <View style={styles.radio}>
                  {navConfig?.iosTemplate === t.id && <View style={styles.radioActive} />}
                </View>
                <Text style={styles.templateText}>{t.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Android Live Navbar Template */}
          <Text style={[styles.sectionHeading, { marginTop: 16 }]}>Android Live Navbar Template</Text>
          <Text style={styles.sectionDesc}>Changes applied here will instantly notify active Android users to refresh their layout.</Text>
          
          <View style={styles.cardGroup}>
            {ANDROID_TEMPLATES.map(t => (
              <Pressable 
                key={t.id}
                style={[styles.templateCard, navConfig?.androidTemplate === t.id && styles.templateCardActive]}
                onPress={() => handleUpdateNav("android", t.id)}
              >
                <View style={styles.radio}>
                  {navConfig?.androidTemplate === t.id && <View style={styles.radioActive} />}
                </View>
                <Text style={styles.templateText}>{t.label}</Text>
              </Pressable>
            ))}
          </View>

          {saving && <ActivityIndicator size="small" color="#6366F1" style={{ marginTop: 20 }} />}
          
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#0B1120" },
  headerTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, marginTop: 8 },
  title: { color: "#fff", fontSize: 24, fontWeight: "800" },
  liveSavedBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(16, 185, 129, 0.15)", borderWidth: 1, borderColor: "rgba(16, 185, 129, 0.3)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  liveSavedText: { color: "#10B981", fontSize: 12, fontWeight: "700" },
  denied: { color: "#64748B", textAlign: "center", marginTop: 60 },
  settingsList: { gap: 16, paddingBottom: 40 },
  
  settingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#131C31", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#1E293B" },
  settingInfo: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12, paddingRight: 16 },
  settingIconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#10B98122", alignItems: "center", justifyContent: "center" },
  settingTitle: { color: "#fff", fontSize: 16, fontWeight: "600", marginBottom: 4 },
  settingSub: { color: "#94A3B8", fontSize: 12, lineHeight: 18 },

  divider: { height: 1, backgroundColor: "#1E293B", marginVertical: 8 },
  
  sectionHeaderRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 4 },
  sectionHeading: { color: "#E2E8F0", fontSize: 18, fontWeight: "700" },
  sectionDesc: { color: "#64748B", fontSize: 12, marginTop: 2, lineHeight: 18 },
  subHeading: { color: "#CBD5E1", fontSize: 14, fontWeight: "700", marginBottom: 8 },

  // Live preview
  previewContainer: { backgroundColor: "#131C31", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#1E293B" },
  previewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  previewBadge: { backgroundColor: "rgba(168, 85, 247, 0.2)", borderWidth: 1, borderColor: "rgba(168, 85, 247, 0.4)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  previewBadgeText: { color: "#C084FC", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  dimensionsBadgeText: { color: "#94A3B8", fontSize: 12, fontWeight: "600" },
  previewScroll: { paddingVertical: 4, paddingHorizontal: 4, justifyContent: "center", alignItems: "center", flexGrow: 1 },
  previewCard: { backgroundColor: "#1E293B", padding: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  previewImageContainer: { position: "relative", marginBottom: 8 },
  previewImage: { width: "100%" },
  popularBadge: { position: "absolute", bottom: 6, left: 6, backgroundColor: "rgba(0,0,0,0.75)", flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, gap: 3 },
  popularBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "600" },
  previewTitle: { color: "#F8FAFC", fontWeight: "700", marginBottom: 6, paddingHorizontal: 2 },
  previewFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: 2 },
  ratingText: { color: "#F8FAFC", fontWeight: "700", fontSize: 11 },
  priceText: { color: "#F8FAFC", fontWeight: "800" },

  // Preset Grid
  presetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  presetCard: { width: "48%", backgroundColor: "#131C31", borderWidth: 1, borderColor: "#1E293B", borderRadius: 12, padding: 12, alignItems: "flex-start" },
  presetCardActive: { borderColor: "#38BDF8", backgroundColor: "rgba(56, 189, 248, 0.1)" },
  presetIconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  presetIconWrapActive: { backgroundColor: "rgba(56, 189, 248, 0.2)" },
  presetLabel: { color: "#F8FAFC", fontSize: 14, fontWeight: "700", marginBottom: 2 },
  presetLabelActive: { color: "#38BDF8" },
  presetDesc: { color: "#64748B", fontSize: 11 },

  // Steppers
  stepperGroup: { backgroundColor: "#131C31", borderRadius: 14, borderWidth: 1, borderColor: "#1E293B", overflow: "hidden" },
  stepperRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: "#1E293B" },
  stepperLabelWrap: { flex: 1, paddingRight: 10 },
  stepperLabel: { color: "#F8FAFC", fontSize: 14, fontWeight: "600" },
  stepperSub: { color: "#64748B", fontSize: 11, marginTop: 2 },
  stepperControls: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepperBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#1E293B", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#334155" },
  stepperBtnDisabled: { opacity: 0.35 },
  stepperValueBox: { minWidth: 70, height: 36, borderRadius: 10, backgroundColor: "#0F172A", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  stepperValueText: { color: "#38BDF8", fontSize: 13, fontWeight: "700" },

  // Reset Button
  resetBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, backgroundColor: "#131C31", borderRadius: 12, borderWidth: 1, borderColor: "#1E293B", marginTop: 4 },
  resetBtnText: { color: "#94A3B8", fontSize: 13, fontWeight: "600" },

  // Navbar Template cards
  cardGroup: { gap: 8 },
  templateCard: { flexDirection: "row", alignItems: "center", padding: 16, backgroundColor: "#131C31", borderRadius: 12, borderWidth: 1, borderColor: "#1E293B", gap: 12 },
  templateCardActive: { borderColor: "#A855F7", backgroundColor: "rgba(168, 85, 247, 0.1)" },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#64748B", alignItems: "center", justifyContent: "center" },
  radioActive: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#A855F7" },
  templateText: { color: "#F8FAFC", fontSize: 15, fontWeight: "600" },
});

