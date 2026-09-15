import { Redirect } from "expo-router";
import { View, Text, Image, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "@/contexts/AuthContext";

export default function Index() {
  const { firebaseUser, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.logoWrap}>
          <Image
            source={require("../assets/images/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title}>COURSE ARENA</Text>
        <Text style={styles.tagline}>
          LEARN <Text style={{ color: "#38BDF8" }}>•</Text> GROW{" "}
          <Text style={{ color: "#38BDF8" }}>•</Text> ACHIEVE
        </Text>

        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#38BDF8" size="small" />
          <Text style={styles.loadingText}>Starting Course Arena...</Text>
        </View>
      </View>
    );
  }

  return <Redirect href={firebaseUser ? "/(tabs)" : "/(auth)/login"} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#080B14",
    padding: 24,
  },
  logoWrap: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.2)",
  },
  logo: {
    width: 80,
    height: 80,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  tagline: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 36,
  },
  loadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  loadingText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
});
