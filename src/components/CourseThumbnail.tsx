import React, { useState } from "react";
import { View, Image, StyleSheet, Text, ImageStyle, StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { normalizeImageUrl } from "@/utils/imageUrl";

interface CourseThumbnailProps {
  uri?: string | null;
  title?: string;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  resizeMode?: "cover" | "contain" | "stretch" | "center";
}

export function CourseThumbnail({
  uri,
  title,
  style,
  containerStyle,
  resizeMode = "cover",
}: CourseThumbnailProps) {
  const [retryWithProxy, setRetryWithProxy] = useState(false);
  const [hasError, setHasError] = useState(false);

  const normalized = normalizeImageUrl(uri);

  // If initial load fails and URL is not already proxied, automatically retry via Cloudflare CDN
  const displayUri = retryWithProxy && normalized && !normalized.includes("wsrv.nl")
    ? `https://wsrv.nl/?url=${encodeURIComponent(normalized)}`
    : normalized;

  // Derive initials / placeholder text
  const initial = (title || "C").trim().charAt(0).toUpperCase();

  if (!displayUri || hasError) {
    return (
      <View style={[styles.fallbackContainer, style as any, containerStyle]}>
        <View style={styles.fallbackIconBadge}>
          <Ionicons name="book-outline" size={24} color="#818CF8" />
        </View>
        {title ? (
          <Text style={styles.fallbackInitial} numberOfLines={1}>
            {initial}
          </Text>
        ) : null}
      </View>
    );
  }

  const handleError = () => {
    if (!retryWithProxy && normalized && !normalized.includes("wsrv.nl")) {
      setRetryWithProxy(true);
    } else {
      setHasError(true);
    }
  };

  return (
    <View style={[styles.wrapper, style as any, containerStyle]}>
      <Image
        source={{ uri: displayUri }}
        style={[styles.image, style]}
        resizeMode={resizeMode}
        fadeDuration={150}
        onError={handleError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  fallbackContainer: {
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  fallbackIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  fallbackInitial: {
    fontSize: 14,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 1,
  },
});
