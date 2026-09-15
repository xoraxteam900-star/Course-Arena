import React, { useEffect, useRef } from "react";
import { View, Text, Platform, Animated, Pressable } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ==========================================
// SHARED UTILS
// ==========================================

const getRouteConfig = (state: any, descriptors: any, navigation: any) => {
  const routes = state.routes.filter((r: any) => r.name !== "courses");
  const leftRoutes = routes.slice(0, 2);
  const rightRoutes = routes.slice(2, 4);

  const getRouteProps = (route: any) => {
    const isFocused = state.index === state.routes.findIndex((r: any) => r.key === route.key);
    const onPress = () => {
      const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
    };
    const labels: any = { index: "Home", "my-courses": "Courses", wallet: "Wallet", profile: "Profile" };
    const icons: any = { index: "home", "my-courses": "book", wallet: "wallet", profile: "person" };
    return { route, isFocused, onPress, label: labels[route.name], name: icons[route.name], hasBadge: route.name === "my-courses" };
  };

  return { routes, leftRoutes, rightRoutes, getRouteProps };
};

// ==========================================
// IOS TEMPLATES
// ==========================================

const IosAnimatedIcon = ({ focused, name, label, hasBadge, onPress, isDark }: any) => {
  const anim = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: focused ? 1 : 0, useNativeDriver: true, friction: 5, tension: 60 }).start();
  }, [focused]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [2, -2] });
  const activeColor = isDark ? "#FFFFFF" : "#0F172A";
  const inactiveColor = isDark ? "rgba(255,255,255,0.5)" : "rgba(15,23,42,0.4)";
  const activeBgOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const handlePressIn = () => Animated.spring(scaleAnim, { toValue: 0.85, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 3, tension: 80 }).start();

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ position: "absolute", width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(15, 23, 42, 0.08)", opacity: activeBgOpacity, transform: [{ scale: scaleAnim }] }} />
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

export function IosPillTabBar({ state, descriptors, navigation, setShowAiChat, colors, isDark }: any) {
  const { routes, getRouteProps } = getRouteConfig(state, descriptors, navigation);

  return (
    <View style={{ position: "absolute", bottom: 30, left: 16, right: 16, flexDirection: "row", alignItems: "center", gap: 12, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 }}>
      <View style={{ flex: 1, height: 60, borderRadius: 30, overflow: "hidden", borderWidth: 1, borderColor: colors.navBorder }}>
        <BlurView intensity={isDark ? 30 : 60} tint={isDark ? "dark" : "light"} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }}>
          {routes.map((route: any) => {
            const props = getRouteProps(route);
            return <IosAnimatedIcon key={route.key} {...props} isDark={isDark} />;
          })}
        </View>
      </View>
      <View>
        <View style={{ width: 56, height: 56, borderRadius: 28, overflow: "hidden", backgroundColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}>
          <Pressable style={{ flex: 1, alignItems: "center", justifyContent: "center" }} onPress={() => setShowAiChat(true)}>
            <Ionicons name="chatbubbles-outline" size={24} color="#FFF" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function IosIslandTabBar({ state, descriptors, navigation, setShowAiChat, colors, isDark }: any) {
  const { routes, getRouteProps } = getRouteConfig(state, descriptors, navigation);
  
  return (
    <View style={{ position: "absolute", bottom: 20, left: 32, right: 32, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 15, shadowOffset: { width: 0, height: 5 }, elevation: 5 }}>
      <View style={{ height: 66, borderRadius: 33, overflow: "hidden", backgroundColor: isDark ? "rgba(10, 10, 20, 0.9)" : "rgba(255, 255, 255, 0.9)", borderWidth: 1, borderColor: colors.border }}>
        <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 }}>
          {routes.map((route: any, index: number) => {
            const props = getRouteProps(route);
            if (index === 2) {
              return (
                <React.Fragment key="ai-btn">
                  <Pressable onPress={() => setShowAiChat(true)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginHorizontal: 4 }}>
                    <Ionicons name="chatbubbles-outline" size={22} color="#FFF" />
                  </Pressable>
                  <IosAnimatedIcon key={route.key} {...props} isDark={isDark} />
                </React.Fragment>
              );
            }
            return <IosAnimatedIcon key={route.key} {...props} isDark={isDark} />;
          })}
        </View>
      </View>
    </View>
  );
}

export function IosMinimalTabBar({ state, descriptors, navigation, setShowAiChat, colors, isDark }: any) {
  const { routes, getRouteProps } = getRouteConfig(state, descriptors, navigation);
  const insets = useSafeAreaInsets();
  
  return (
    <View style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
      <BlurView intensity={isDark ? 50 : 80} tint={isDark ? "dark" : "light"} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 10, paddingBottom: Math.max(insets.bottom, 10), borderTopWidth: 0.5, borderTopColor: "rgba(150,150,150,0.2)" }}>
        {routes.map((route: any, index: number) => {
          const props = getRouteProps(route);
          if (index === 2) {
            return (
              <React.Fragment key="ai-btn">
                <Pressable onPress={() => setShowAiChat(true)} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="chatbubbles-outline" size={20} color="#FFF" />
                  </View>
                </Pressable>
                <IosAnimatedIcon key={route.key} {...props} isDark={isDark} />
              </React.Fragment>
            );
          }
          return <IosAnimatedIcon key={route.key} {...props} isDark={isDark} />;
        })}
      </View>
    </View>
  );
}

// ==========================================
// ANDROID TEMPLATES
// ==========================================

const AndroidTabIcon = ({ focused, name, label, hasBadge, onPress }: any) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 3, tension: 80 }).start();
  const activeColor = "#1769E0"; 
  const inactiveColor = "#9CA3AF"; 

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 8 }}>
      <Animated.View style={{ alignItems: "center", transform: [{ scale: scaleAnim }] }}>
        <View style={{ alignItems: "center", justifyContent: "center", backgroundColor: focused ? "rgba(23, 105, 224, 0.1)" : "transparent", paddingVertical: 4, paddingHorizontal: 12, borderRadius: 16 }}>
          <Ionicons name={focused ? name : `${name}-outline`} color={focused ? activeColor : inactiveColor} size={22} />
          {hasBadge && (
            <View style={{ position: "absolute", top: 4, right: 8, backgroundColor: "#EF4444", width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: focused ? "rgba(23, 105, 224, 0.1)" : "transparent" }} />
          )}
        </View>
        <Text style={{ color: focused ? activeColor : inactiveColor, fontSize: 10, fontWeight: "600", marginTop: 4 }}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
};

export function AndroidUnifiedTabBar({ state, descriptors, navigation, setShowAiChat }: any) {
  const insets = useSafeAreaInsets();
  const { leftRoutes, rightRoutes, getRouteProps } = getRouteConfig(state, descriptors, navigation);

  return (
    <View style={{
      position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#FFFFFF", 
      borderTopLeftRadius: 24, borderTopRightRadius: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 12, paddingTop: 0, paddingBottom: Math.max(insets.bottom, 4), borderTopWidth: 1, borderTopColor: "#F3F4F6", elevation: 10,
    }}>
      {leftRoutes.map((route: any) => <AndroidTabIcon key={route.key} {...getRouteProps(route)} />)}
      
      <View style={{ marginTop: -20, marginHorizontal: 4 }}>
        <Pressable onPress={() => setShowAiChat(true)} style={{ alignItems: "center" }}>
          <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: "#1769E0", alignItems: "center", justifyContent: "center", shadowColor: "#1769E0", shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 6 }}>
            <Ionicons name="chatbubbles-outline" size={24} color="#FFF" />
          </View>
        </Pressable>
      </View>

      {rightRoutes.map((route: any) => <AndroidTabIcon key={route.key} {...getRouteProps(route)} />)}
    </View>
  );
}

export function AndroidFlatTabBar({ state, descriptors, navigation, setShowAiChat }: any) {
  const insets = useSafeAreaInsets();
  const { routes, getRouteProps } = getRouteConfig(state, descriptors, navigation);

  return (
    <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#FFFFFF", flexDirection: "row", paddingTop: 8, paddingBottom: Math.max(insets.bottom, 8), elevation: 8, borderTopWidth: 1, borderTopColor: "#F3F4F6" }}>
      {routes.map((route: any, index: number) => {
        const props = getRouteProps(route);
        if (index === 2) {
          return (
            <React.Fragment key="ai-btn">
              <Pressable onPress={() => setShowAiChat(true)} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="chatbubbles-outline" size={26} color="#1769E0" />
                <Text style={{ color: "#1769E0", fontSize: 10, fontWeight: "600", marginTop: 4 }}>Chat</Text>
              </Pressable>
              <AndroidTabIcon key={route.key} {...props} />
            </React.Fragment>
          );
        }
        return <AndroidTabIcon key={route.key} {...props} />;
      })}
    </View>
  );
}

export function AndroidFloatingTabBar({ state, descriptors, navigation, setShowAiChat }: any) {
  const { routes, getRouteProps } = getRouteConfig(state, descriptors, navigation);

  return (
    <View style={{ position: "absolute", bottom: 16, left: 16, right: 16, backgroundColor: "#FFFFFF", borderRadius: 30, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, elevation: 6, height: 60, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
      {routes.map((route: any, index: number) => {
        const props = getRouteProps(route);
        if (index === 2) {
          return (
            <React.Fragment key="ai-btn">
              <Pressable onPress={() => setShowAiChat(true)} style={{ marginHorizontal: 8, width: 44, height: 44, borderRadius: 22, backgroundColor: "#1769E0", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="chatbubbles-outline" size={20} color="#FFF" />
              </Pressable>
              <AndroidTabIcon key={route.key} {...props} />
            </React.Fragment>
          );
        }
        return <AndroidTabIcon key={route.key} {...props} />;
      })}
    </View>
  );
}
