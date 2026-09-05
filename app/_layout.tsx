import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View, LogBox } from "react-native";

LogBox.ignoreLogs([
  "WebChannelConnection RPC 'Listen' stream",
  "@firebase/firestore",
]);

SplashScreen.preventAutoHideAsync().catch(() => {});

function AnimatedSplashScreen({ children }: { children: React.ReactNode }) {
  const [isAppReady, setAppReady] = useState(false);
  const [isSplashAnimationComplete, setAnimationComplete] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    async function prepare() {
      // Allow the app to load any required resources
      await new Promise((resolve) => setTimeout(resolve, 800));
      setAppReady(true);
    }
    prepare();
  }, []);

  useEffect(() => {
    if (isAppReady) {
      SplashScreen.hideAsync().catch(() => {});
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.1, friction: 5, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 400, delay: 200, useNativeDriver: true })
      ]).start(() => {
        setAnimationComplete(true);
      });
    }
  }, [isAppReady]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {!isSplashAnimationComplete && (
        <Animated.View 
          style={[
            StyleSheet.absoluteFill, 
            { backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", opacity: opacityAnim, zIndex: 9999 }
          ]}
          pointerEvents="none"
        >
          <Animated.Image 
            source={require("../assets/images/logo.png")} 
            style={{ width: 250, height: 250, transform: [{ scale: scaleAnim }] }} 
            resizeMode="contain" 
          />
        </Animated.View>
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AnimatedSplashScreen>
        <AuthProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="course/[id]" options={{ headerShown: true, title: "Course" }} />
            <Stack.Screen name="notifications" options={{ headerShown: true, title: "Notifications" }} />
            <Stack.Screen name="instructor" options={{ headerShown: true, title: "Instructor" }} />
            <Stack.Screen name="admin" options={{ headerShown: true, title: "Admin" }} />
          </Stack>
        </AuthProvider>
      </AnimatedSplashScreen>
    </ThemeProvider>
  );
}
