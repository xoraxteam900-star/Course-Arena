import { useState, useRef } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { View, StyleSheet, Pressable, Text, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, WebViewNavigation } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";

export default function CourseViewer() {
  const { url } = useLocalSearchParams<{ url: string }>();
  const { isDark, colors } = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const rawUrl = Array.isArray(url) ? url[0] : url;
  if (!rawUrl) return null;

  const decoded = decodeURIComponent(rawUrl).trim();
  const formattedUrl = decoded.startsWith("http://") || decoded.startsWith("https://")
    ? decoded
    : `https://${decoded}`;

  // Validate URL structure
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

  // Injected JavaScript to protect course links and force internal navigation:
  // 1. Prevents long press context menu (saving images, copying links)
  // 2. Forces target="_blank" to stay inside current WebView
  const secureInjectedJs = `
    (function() {
      document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        return false;
      }, false);

      function forceSelfTarget() {
        var links = document.querySelectorAll('a[target="_blank"]');
        links.forEach(function(a) {
          a.setAttribute('target', '_self');
        });
      }
      forceSelfTarget();
      var observer = new MutationObserver(forceSelfTarget);
      observer.observe(document.documentElement, { childList: true, subtree: true });
    })();
    true;
  `;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* SECURE IN-APP HEADER (Hidden in Full Screen Mode) */}
      {!isFullScreen ? (
        <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: borderCol }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="close" size={24} color={textColor} />
            <Text style={[styles.backText, { color: textColor }]}>Close</Text>
          </Pressable>

          {/* Secure Shield Badge */}
          <View style={styles.secureBadge}>
            <Ionicons name="shield-checkmark" size={14} color="#10B981" />
            <Text style={styles.secureBadgeText}>Secure In-App Player</Text>
          </View>

          {/* In-app Navigation Controls (Back, Forward, Refresh, Fullscreen) */}
          <View style={styles.controlRow}>
            <Pressable
              onPress={() => canGoBack && webViewRef.current?.goBack()}
              disabled={!canGoBack}
              style={[styles.iconControlBtn, { opacity: canGoBack ? 1 : 0.35 }]}
              hitSlop={6}
            >
              <Ionicons name="chevron-back" size={20} color={textColor} />
            </Pressable>

            <Pressable
              onPress={() => canGoForward && webViewRef.current?.goForward()}
              disabled={!canGoForward}
              style={[styles.iconControlBtn, { opacity: canGoForward ? 1 : 0.35 }]}
              hitSlop={6}
            >
              <Ionicons name="chevron-forward" size={20} color={textColor} />
            </Pressable>

            <Pressable
              onPress={() => {
                setLoadError(null);
                webViewRef.current?.reload();
              }}
              style={styles.iconControlBtn}
              hitSlop={6}
            >
              <Ionicons name="reload" size={18} color="#6366F1" />
            </Pressable>

            <Pressable
              onPress={() => setIsFullScreen(true)}
              style={[styles.fullscreenBtn, { backgroundColor: isDark ? "#1E293B" : "#EEF2F6" }]}
              hitSlop={8}
            >
              <Ionicons name="expand-outline" size={16} color="#6366F1" />
              <Text style={styles.fullscreenText}>Full</Text>
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
          <Text style={[styles.errorTitle, { color: textColor }]}>Invalid Course Content</Text>
          <Text style={[styles.errorSubtitle, { color: textDimColor }]}>
            The secure course link could not be verified. Please contact the instructor or support.
          </Text>
          <View style={styles.btnRow}>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: "#6366F1" }]}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Go Back</Text>
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
          allowsBackForwardNavigationGestures={true}
          setSupportMultipleWindows={false}
          injectedJavaScriptBeforeContentLoaded={secureInjectedJs}
          onNavigationStateChange={(nav: WebViewNavigation) => {
            setCanGoBack(nav.canGoBack);
            setCanGoForward(nav.canGoForward);
          }}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            setLoadError(nativeEvent.description || "Failed to load course");
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
              reqUrl.startsWith("about:") ||
              reqUrl.startsWith("data:")
            ) {
              return true;
            }
            return false;
          }}
          renderError={() => (
            <View style={[styles.errorContainer, { backgroundColor: bg }]}>
              <View style={styles.errorIconCircle}>
                <Ionicons name="cloud-offline-outline" size={48} color="#EF4444" />
              </View>
              <Text style={[styles.errorTitle, { color: textColor }]}>Unable to Stream Course</Text>
              <Text style={[styles.errorSubtitle, { color: textDimColor }]}>
                {loadError || "Could not establish a secure connection to the course materials. Please check your internet connection and try again."}
              </Text>
              <View style={[styles.securityNoticeBox, { backgroundColor: cardBg, borderColor: borderCol }]}>
                <Ionicons name="lock-closed-outline" size={16} color="#10B981" />
                <Text style={[styles.securityNoticeText, { color: textDimColor }]}>
                  Course materials are encrypted & protected inside Course Arena
                </Text>
              </View>
              <View style={styles.btnRow}>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: "#6366F1" }]}
                  onPress={() => {
                    setLoadError(null);
                    webViewRef.current?.reload();
                  }}
                >
                  <Ionicons name="reload" size={16} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>Retry Loading</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtnSecondary, { borderColor: borderCol }]}
                  onPress={() => router.back()}
                >
                  <Text style={[styles.actionBtnSecondaryText, { color: textColor }]}>
                    Go Back
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
          renderLoading={() => (
            <View style={[styles.loadingContainer, { backgroundColor: bg }]}>
              <ActivityIndicator size="large" color="#6366F1" />
              <Text style={[styles.loadingText, { color: textDimColor }]}>
                Decrypting and loading course...
              </Text>
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  backText: {
    fontSize: 15,
    fontWeight: "600",
  },
  secureBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  secureBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#10B981",
  },
  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconControlBtn: {
    padding: 6,
    borderRadius: 8,
  },
  fullscreenBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  fullscreenText: {
    color: "#6366F1",
    fontSize: 13,
    fontWeight: "700",
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
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  errorSubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  securityNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    width: "100%",
    marginBottom: 24,
  },
  securityNoticeText: {
    fontSize: 12,
    flex: 1,
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
    fontSize: 14,
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
    fontSize: 14,
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
