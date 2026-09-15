import React, { useEffect, useState } from "react";
import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { View, ActivityIndicator, Platform, Pressable, Text, StyleSheet, Animated, Image } from "react-native";
import AiChatModal from "@/components/AiChatModal";
import { listenToNavbarConfig, NavbarConfig, defaultNavbarConfig } from "@/services/navbarSettings";
import { 
  IosPillTabBar, IosIslandTabBar, IosMinimalTabBar,
  AndroidUnifiedTabBar, AndroidFlatTabBar, AndroidFloatingTabBar 
} from "@/components/NavBars/Templates";
import { NavBarVisibilityProvider, useNavBarVisibility } from "@/contexts/NavBarVisibilityContext";

function TabsContent() {
  const { firebaseUser, loading } = useAuth();
  const { colors, isDark } = useTheme();
  const { isNavBarVisible, animValue, showNavBar, hideNavBar, toggleNavBar } = useNavBarVisibility();
  
  const [showAiChat, setShowAiChat] = useState(false);
  const [activeConfig, setActiveConfig] = useState<NavbarConfig>(defaultNavbarConfig);

  useEffect(() => {
    if (!firebaseUser) return;
    
    const unsubscribe = listenToNavbarConfig((newConfig) => {
      setActiveConfig(newConfig);
    });

    return () => unsubscribe();
  }, [firebaseUser]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: isDark ? "#080B14" : colors.background }]}>
        <View style={styles.loadingLogoWrap}>
          <Image
            source={require("../../assets/images/logo.png")}
            style={{ width: 70, height: 70 }}
            resizeMode="contain"
          />
        </View>
        <Text style={[styles.loadingTitle, { color: colors.text }]}>COURSE ARENA</Text>
        <ActivityIndicator color="#1769E0" size="small" style={{ marginTop: 12 }} />
      </View>
    );
  }
  if (!firebaseUser) return <Redirect href="/(auth)/login" />;

  const renderTabBar = (props: any) => {
    const templateProps = { ...props, setShowAiChat, colors, isDark, hideNavBar, toggleNavBar };
    let barElement = null;
    
    if (Platform.OS === "ios") {
      switch (activeConfig.iosTemplate) {
        case "ios-island": barElement = <IosIslandTabBar {...templateProps} />; break;
        case "ios-minimal": barElement = <IosMinimalTabBar {...templateProps} />; break;
        case "ios-pill":
        default: barElement = <IosPillTabBar {...templateProps} />; break;
      }
    } else {
      switch (activeConfig.androidTemplate) {
        case "android-flat": barElement = <AndroidFlatTabBar {...templateProps} />; break;
        case "android-floating": barElement = <AndroidFloatingTabBar {...templateProps} />; break;
        case "android-unified":
        default: barElement = <AndroidUnifiedTabBar {...templateProps} />; break;
      }
    }

    const translateY = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [120, 0],
    });

    const opacity = animValue.interpolate({
      inputRange: [0, 0.4, 1],
      outputRange: [0, 0.5, 1],
    });

    return (
      <Animated.View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          transform: [{ translateY }],
          opacity,
        }}
        pointerEvents={isNavBarVisible ? "auto" : "none"}
      >
        {barElement}
      </Animated.View>
    );
  };

  return (
    <>
      <Tabs
        tabBar={renderTabBar}
        screenOptions={{ lazy: false, headerShown: false }}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="courses" options={{ href: null }} />
        <Tabs.Screen name="my-courses" options={{ title: "Courses" }} />
        <Tabs.Screen name="wallet" options={{ title: "Wallet" }} />
        <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      </Tabs>

      {/* Floating restore button when in full-screen mode */}
      {!isNavBarVisible && (
        <Pressable
          style={[
            styles.floatingRestoreBtn,
            {
              backgroundColor: isDark ? "rgba(15, 23, 42, 0.92)" : "rgba(255, 255, 255, 0.95)",
              borderColor: isDark ? "rgba(255, 255, 255, 0.16)" : "rgba(0, 0, 0, 0.12)",
            },
          ]}
          onPress={showNavBar}
          hitSlop={8}
        >
          <Ionicons name="apps" size={17} color="#1769E0" />
          <Text style={[styles.floatingRestoreText, { color: colors.text }]}>Show Nav</Text>
        </Pressable>
      )}

      <AiChatModal visible={showAiChat} onClose={() => setShowAiChat(false)} />
    </>
  );
}

export default function TabsLayout() {
  return (
    <NavBarVisibilityProvider>
      <TabsContent />
    </NavBarVisibilityProvider>
  );
}

const styles = StyleSheet.create({
  floatingRestoreBtn: {
    position: "absolute",
    bottom: 24,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 9999,
  },
  floatingRestoreText: {
    fontSize: 12,
    fontWeight: "700",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingLogoWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 3,
  },
});
