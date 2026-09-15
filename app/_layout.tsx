import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox } from "react-native";
import { FullScreenVideoSplash } from "@/components/FullScreenVideoSplash";

LogBox.ignoreLogs([
  "WebChannelConnection RPC 'Listen' stream",
  "@firebase/firestore",
  "Could not reach Cloud Firestore backend",
  "Backend didn't respond within 10 seconds",
  "Firestore (11.",
  "Encountered an error loading page",
  "net::ERR_NAME_NOT_RESOLVED",
]);

// Dismiss any native OS splash immediately so the full-screen video animation takes over at frame 0
SplashScreen.hideAsync().catch(() => {});

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <FullScreenVideoSplash>
          <AuthProvider>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="course/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="course/viewer" options={{ headerShown: false }} />
              <Stack.Screen name="notifications" options={{ headerShown: false }} />
              <Stack.Screen name="instructor/index" options={{ headerShown: false }} />
              <Stack.Screen name="instructor/new-course" options={{ headerShown: false }} />
              <Stack.Screen name="chat/index" options={{ headerShown: false }} />
              <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="admin" options={{ headerShown: false }} />
            </Stack>
          </AuthProvider>
        </FullScreenVideoSplash>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
