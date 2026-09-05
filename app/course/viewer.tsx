import { useLocalSearchParams, router } from "expo-router";
import { View, StyleSheet, Pressable, Text, ActivityIndicator } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";

export default function CourseViewer() {
  const { url } = useLocalSearchParams<{ url: string }>();
  const rawUrl = Array.isArray(url) ? url[0] : url;
  if (!rawUrl) return null;

  const decoded = decodeURIComponent(rawUrl);
  const formattedUrl = decoded.startsWith("http") ? decoded : `https://${decoded}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0F172A" }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color="#fff" />
          <Text style={styles.backText}>Close</Text>
        </Pressable>
        <Pressable onPress={() => WebBrowser.openBrowserAsync(formattedUrl)} style={styles.browserBtn}>
          <Ionicons name="open-outline" size={20} color="#6366F1" />
          <Text style={styles.browserText}>Open in Browser</Text>
        </Pressable>
      </View>
      <WebView 
        source={{ uri: formattedUrl }} 
        style={{ flex: 1, backgroundColor: "#0F172A" }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        allowsFullscreenVideo={true}
        renderLoading={() => (
          <View style={{ flex: 1, backgroundColor: "#0F172A", justifyContent: "center", alignItems: "center", position: "absolute", width: "100%", height: "100%" }}>
            <ActivityIndicator size="large" color="#6366F1" />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0F172A",
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  browserBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1E293B",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  browserText: {
    color: "#6366F1",
    fontSize: 14,
    fontWeight: "600",
  }
});
