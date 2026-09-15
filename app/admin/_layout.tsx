import { useState, useRef } from "react";
import { View, Animated, StyleSheet, Pressable, Text, Dimensions } from "react-native";
import { Stack, router, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";

const { width } = Dimensions.get("window");
const DRAWER_WIDTH = width * 0.75;

export default function AdminLayout() {
  const [isOpen, setIsOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pathname = usePathname();
  const { profile } = useAuth();

  const toggleDrawer = () => {
    if (isOpen) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -DRAWER_WIDTH, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true })
      ]).start(() => setIsOpen(false));
    } else {
      setIsOpen(true);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true })
      ]).start();
    }
  };

  const closeDrawer = () => {
    if (isOpen) toggleDrawer();
  };

  const navigateTo = (path: any) => {
    closeDrawer();
    if (pathname !== path) {
      router.push(path);
    }
  };

  const menuItems = [
    { name: "Dashboard", path: "/admin", icon: "grid-outline" },
    { name: "Users", path: "/admin/users", icon: "people-outline" },
    { name: "Courses", path: "/admin/courses", icon: "library-outline" },
    { name: "Categories", path: "/admin/categories", icon: "folder-outline" },
    { name: "Polls & Votes", path: "/admin/polls", icon: "bar-chart-outline" },
    { name: "Reports", path: "/admin/reports", icon: "warning-outline" },
    { name: "Promos", path: "/admin/promos", icon: "gift-outline" },
    { name: "New Course", path: "/admin/new-course", icon: "add-circle-outline" },
    { name: "Notifications", path: "/admin/notifications", icon: "notifications-outline" },
    { name: "Broadcast", path: "/admin/broadcast", icon: "megaphone-outline" },
    { name: "Settings", path: "/admin/settings", icon: "settings-outline" },
  ];

  if (profile?.role !== "admin") {
    return (
      <View style={{ flex: 1, backgroundColor: "#0B1120", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#64748B" }}>Admin access only.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0B1120" },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "700" },
          headerLeft: () => (
            <Pressable onPress={toggleDrawer} style={{ marginLeft: 16 }}>
              <Ionicons name="menu" size={28} color="#fff" />
            </Pressable>
          ),
        }}
      >
        <Stack.Screen name="index" options={{ title: "Admin Dashboard" }} />
        <Stack.Screen name="users" options={{ title: "Manage Users" }} />
        <Stack.Screen name="courses" options={{ title: "Manage Courses" }} />
        <Stack.Screen name="categories" options={{ title: "Categories" }} />
        <Stack.Screen name="reports" options={{ title: "Reports" }} />
        <Stack.Screen name="promos" options={{ title: "Promotions" }} />
        <Stack.Screen name="new-course" options={{ title: "New Course" }} />
        <Stack.Screen name="edit-course" options={{ title: "Edit Course" }} />
        <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
        <Stack.Screen name="broadcast" options={{ title: "Broadcast" }} />
      </Stack>

      {isOpen && (
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <Pressable style={{ flex: 1 }} onPress={closeDrawer} />
        </Animated.View>
      )}

      <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.drawerHeader}>
            <View style={styles.logoWrap}>
              <Ionicons name="shield-checkmark" size={24} color="#6366F1" />
            </View>
            <Text style={styles.drawerTitle}>Admin Panel</Text>
          </View>

          <View style={styles.menuList}>
            {menuItems.map((item, index) => {
              const isActive = pathname === item.path;
              return (
                <Pressable
                  key={index}
                  style={[styles.menuItem, isActive && styles.menuItemActive]}
                  onPress={() => navigateTo(item.path)}
                >
                  <Ionicons name={item.icon as any} size={22} color={isActive ? "#fff" : "#94A3B8"} />
                  <Text style={[styles.menuText, isActive && styles.menuTextActive]}>{item.name}</Text>
                </Pressable>
              );
            })}
          </View>
          
          <Pressable style={styles.exitBtn} onPress={() => router.replace("/(tabs)")}>
            <Ionicons name="exit-outline" size={22} color="#F87171" />
            <Text style={styles.exitText}>Exit Admin</Text>
          </Pressable>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.6)",
    zIndex: 10,
  },
  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    backgroundColor: "#131C31",
    zIndex: 20,
    borderRightWidth: 1,
    borderRightColor: "#1E293B",
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
    gap: 12,
  },
  logoWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#6366F122",
    alignItems: "center",
    justifyContent: "center",
  },
  drawerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  menuList: {
    padding: 16,
    gap: 8,
    flex: 1,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
  },
  menuItemActive: {
    backgroundColor: "#6366F1",
  },
  menuText: {
    color: "#94A3B8",
    fontSize: 16,
    fontWeight: "600",
  },
  menuTextActive: {
    color: "#fff",
  },
  exitBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
  },
  exitText: {
    color: "#F87171",
    fontSize: 16,
    fontWeight: "600",
  },
});
