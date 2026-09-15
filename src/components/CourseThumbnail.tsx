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
  const [hasError, setHasError] = useState(false);
  const normalized = normalizeImageUrl(uri);

  // Derive initials / placeholder text
  const initial = (title || "C").trim().charAt(0).toUpperCase();

  if (!normalized || hasError) {
    return (
      <View style={[styles.fallbackContainer, containerStyle, style as any]}>
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

  return (
    <View style={[styles.wrapper, containerStyle]}>
      <Image
        source={{ uri: normalized }}
        style={[styles.image, style]}
        resizeMode={resizeMode}
        onError={() => setHasError(true)}
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
