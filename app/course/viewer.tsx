import { useState, useRef } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { View, StyleSheet, Pressable, Text, ActivityIndicator, Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";

export default function CourseViewer() {
  const { url } = useLocalSearchParams<{ url: string }>();
  const { isDark, colors } = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const rawUrl = Array.isArray(url) ? url[0] : url;
  if (!rawUrl) return null;

  const decoded = decodeURIComponent(rawUrl).trim();
  const formattedUrl = decoded.startsWith("http://") || decoded.startsWith("https://")
    ? decoded
    : `https://${decoded}`;

  // Validate URL structure: must have a protocol and a hostname with at least one dot or localhost
  let isValidUrl = false;
  try {
    const parsed = new URL(formattedUrl);
    isValidUrl = Boolean(
      parsed.hostname &&
      (parsed.hostname.includes(".") || parsed.hostname === "localhost") &&
      parsed.hostname.length > 3
    );
  } catch {
    isValidUrl = false;
  }

  const bg = isDark ? "#070B14" : colors.background;
  const cardBg = isDark ? "#101625" : colors.card;
  const textColor = isDark ? "#FFFFFF" : "#0F172A";
  const textDimColor = isDark ? "#94A3B8" : "#64748B";
  const borderCol = isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* HEADER (Hidden in Full Screen Mode) */}
      {!isFullScreen ? (
        <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: borderCol }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="close" size={24} color={textColor} />
            <Text style={[styles.backText, { color: textColor }]}>Close</Text>
          </Pressable>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable
              onPress={() => setIsFullScreen(true)}
              style={[styles.browserBtn, { backgroundColor: isDark ? "#1E293B" : "#EEF2F6" }]}
              hitSlop={8}
            >
              <Ionicons name="expand-outline" size={17} color="#6366F1" />
              <Text style={styles.browserText}>Full Screen</Text>
            </Pressable>

            <Pressable
              onPress={() => WebBrowser.openBrowserAsync(formattedUrl).catch(() => {})}
              style={[styles.browserBtn, { backgroundColor: isDark ? "#1E293B" : "#EEF2F6" }]}
              hitSlop={8}
            >
              <Ionicons name="open-outline" size={17} color="#6366F1" />
              <Text style={styles.browserText}>Browser</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          style={styles.floatingExitBtn}
          onPress={() => setIsFullScreen(false)}
          hitSlop={10}
        >
          <Ionicons name="contract-outline" size={18} color="#FFFFFF" />
          <Text style={styles.floatingExitText}>Exit Full Screen</Text>
        </Pressable>
      )}

      {/* BODY CONTENT */}
      {!isValidUrl ? (
        <View style={styles.errorContainer}>
          <View style={styles.errorIconCircle}>
            <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          </View>
          <Text style={[styles.errorTitle, { color: textColor }]}>Invalid Course Link</Text>
          <Text style={[styles.errorSubtitle, { color: textDimColor }]}>
            The access link for this course does not appear to be a complete web address.
          </Text>
          <View style={[styles.urlBox, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <Text style={[styles.urlText, { color: textColor }]} numberOfLines={2}>
              {formattedUrl}
            </Text>
          </View>
          <View style={styles.btnRow}>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: "#6366F1" }]}
              onPress={() => WebBrowser.openBrowserAsync(formattedUrl).catch(() => {})}
            >
              <Ionicons name="open-outline" size={16} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Try in Browser</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtnSecondary, { borderColor: borderCol }]}
              onPress={() => router.back()}
            >
              <Text style={[styles.actionBtnSecondaryText, { color: textColor }]}>Go Back</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: formattedUrl }}
          style={{ flex: 1, backgroundColor: bg }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          allowsFullscreenVideo={true}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            setLoadError(nativeEvent.description || "Failed to load page");
          }}
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            if (nativeEvent.statusCode >= 400) {
              setLoadError(`HTTP ${nativeEvent.statusCode}: Could not load course`);
            }
          }}
          onShouldStartLoadWithRequest={(request) => {
            const reqUrl = request.url;
            if (
              reqUrl.startsWith("http://") ||
              reqUrl.startsWith("https://") ||
              reqUrl === "about:blank"
            ) {
              return true;
            }
            Linking.canOpenURL(reqUrl).then((supported) => {
              if (supported) {
                Linking.openURL(reqUrl).catch(() => {});
              }
            }).catch(() => {});
            return false;
          }}
          renderError={(errorDomain, errorCode, errorDesc) => (
            <View style={[styles.errorContainer, { backgroundColor: bg }]}>
              <View style={styles.errorIconCircle}>
                <Ionicons name="cloud-offline-outline" size={48} color="#EF4444" />
              </View>
              <Text style={[styles.errorTitle, { color: textColor }]}>Page Load Error</Text>
              <Text style={[styles.errorSubtitle, { color: textDimColor }]}>
                {errorCode === -1003
                  ? "A server with the specified hostname could not be found. Please verify the course link or check your internet connection."
                  : errorDesc || "Unable to resolve or connect to this web address."}
              </Text>
              <View style={[styles.urlBox, { backgroundColor: cardBg, borderColor: borderCol }]}>
                <Text style={[styles.urlText, { color: textColor }]} numberOfLines={2}>
                  {formattedUrl}
                </Text>
              </View>
              <View style={styles.btnRow}>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: "#6366F1" }]}
                  onPress={() => webViewRef.current?.reload()}
                >
                  <Ionicons name="reload" size={16} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>Retry</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtnSecondary, { borderColor: borderCol }]}
                  onPress={() => WebBrowser.openBrowserAsync(formattedUrl).catch(() => {})}
                >
                  <Ionicons name="open-outline" size={16} color={textColor} />
                  <Text style={[styles.actionBtnSecondaryText, { color: textColor }]}>
                    Open in Browser
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
          renderLoading={() => (
            <View style={[styles.loadingContainer, { backgroundColor: bg }]}>
              <ActivityIndicator size="large" color="#6366F1" />
              <Text style={[styles.loadingText, { color: textDimColor }]}>Loading course content...</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backText: {
    fontSize: 16,
    fontWeight: "600",
  },
  browserBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  browserText: {
    color: "#6366F1",
    fontSize: 14,
    fontWeight: "600",
  },
  loadingContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "500",
  },
  errorContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    zIndex: 10,
  },
  errorIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  errorSubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  urlBox: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    width: "100%",
    marginBottom: 24,
  },
  urlText: {
    fontSize: 13,
    textAlign: "center",
    fontWeight: "500",
  },
  btnRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 12,
    gap: 6,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  actionBtnSecondaryText: {
    fontWeight: "600",
    fontSize: 15,
  },
  floatingExitBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    elevation: 8,
  },
  floatingExitText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
});
