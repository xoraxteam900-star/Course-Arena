import React, { useEffect, useRef } from "react";
import { Tabs, Redirect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { View, Text, ActivityIndicator, Platform, Animated, Pressable } from "react-native";
import { BlurView } from "expo-blur";

const TabIcon = ({ focused, name, label, hasBadge, onPress, isDark }: { focused: boolean, name: any, label: string, hasBadge?: boolean, onPress: () => void, isDark: boolean }) => {
  const anim = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      friction: 5,
      tension: 60,
    }).start();
  }, [focused]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, -2],
  });

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.85, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 3, tension: 80 }).start();
  };

  const activeColor = isDark ? "#FFFFFF" : "#0F172A";
  const inactiveColor = isDark ? "rgba(255,255,255,0.5)" : "rgba(15,23,42,0.4)";

  const activeBgOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Pressable 
      onPress={onPress} 
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      <Animated.View style={{ 
        position: "absolute", 
        width: 40, 
        height: 40, 
        borderRadius: 20, 
        backgroundColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(15, 23, 42, 0.08)", // Active capsule
        opacity: activeBgOpacity,
        transform: [{ scale: scaleAnim }],
      }} />
      <Animated.View style={{ alignItems: "center", justifyContent: "center", transform: [{ translateY }, { scale: scaleAnim }] }}>
        <View>
          <Ionicons name={focused ? name : `${name}-outline`} color={focused ? activeColor : inactiveColor} size={18} />
          {hasBadge && (
            <View style={{ position: "absolute", top: -4, right: -6, backgroundColor: "#F0444A", borderRadius: 10, paddingHorizontal: 4, paddingVertical: 1, borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.18)" : "#FFF" }}>
              <Text style={{ color: "#FFF", fontSize: 8, fontWeight: "900" }}>3</Text>
            </View>
          )}
        </View>
        <Text style={{ color: focused ? activeColor : inactiveColor, fontSize: 9, fontWeight: "700", marginTop: 2 }}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
};

function CustomTabBar({ state, descriptors, navigation }: any) {
  const { colors, isDark } = useTheme();

  return (
    <View style={{
      position: "absolute",
      bottom: Platform.OS === "ios" ? 30 : 20,
      left: 16,
      right: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: Platform.OS === "ios" ? 30 : 10,
      shadowOffset: { width: 0, height: Platform.OS === "ios" ? 10 : 4 },
      elevation: 8,
    }}>
      {/* Main Glass Pill */}
      <View style={{ flex: 1, height: 60, borderRadius: 30, overflow: "hidden", borderWidth: 1, borderColor: colors.navBorder }}>
        {Platform.OS === "ios" && <BlurView intensity={isDark ? 30 : 60} tint={isDark ? "dark" : "light"} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />}
        <View style={{ flex: 1, backgroundColor: Platform.OS === "android" ? (isDark ? "rgba(15, 23, 42, 0.98)" : "rgba(255, 255, 255, 0.98)") : colors.navBar, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }}>
          {state.routes.filter((r: any) => r.name !== "courses").map((route: any, index: number) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === state.routes.findIndex((r: any) => r.key === route.key);
            
            const onPress = () => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const labels: any = { index: "Home", "my-courses": "Courses", wallet: "Wallet", profile: "Profile" };
            const icons: any = { index: "home", "my-courses": "school", wallet: "wallet", profile: "person" };

            return (
              <TabIcon 
                key={route.key} 
                focused={isFocused} 
                name={icons[route.name]} 
                label={labels[route.name]} 
                onPress={onPress} 
                hasBadge={route.name === "my-courses"} 
                isDark={isDark}
              />
            );
          })}
        </View>
      </View>

      {/* Floating Circular Search Button */}
      <View style={{ width: 60, height: 60, borderRadius: 30, overflow: "hidden", borderWidth: 1, borderColor: colors.navBorder }}>
        {Platform.OS === "ios" && <BlurView intensity={isDark ? 30 : 60} tint={isDark ? "dark" : "light"} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />}
        <View style={{ flex: 1, backgroundColor: Platform.OS === "android" ? (isDark ? "rgba(15, 23, 42, 0.98)" : "rgba(255, 255, 255, 0.98)") : colors.navBar }}>
          <Pressable 
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
            onPress={() => router.push("/(tabs)/courses")}
          >
            <Ionicons name="search" size={24} color={isDark ? "#FFFFFF" : "#0F172A"} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { firebaseUser, loading } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!firebaseUser) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      tabBar={Platform.OS === "ios" ? (props) => <CustomTabBar {...props} /> : undefined}
      screenOptions={{ 
        lazy: false,
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: Platform.OS === "android" ? {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        } : {},
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} /> }} />
      <Tabs.Screen name="courses" options={{ href: Platform.OS === "android" ? null : undefined, title: "Explore", tabBarIcon: ({ color }) => <Ionicons name="search" size={24} color={color} /> }} />
      <Tabs.Screen name="my-courses" options={{ title: "Courses", tabBarIcon: ({ color }) => <Ionicons name="school" size={24} color={color} /> }} />
      <Tabs.Screen name="wallet" options={{ title: "Wallet", tabBarIcon: ({ color }) => <Ionicons name="wallet" size={24} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} /> }} />
    </Tabs>
  );
}
