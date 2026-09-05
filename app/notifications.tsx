import { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { listNotificationsFor } from "@/services/notifications";
import { AppNotification } from "@/types";

export default function Notifications() {
  const { profile } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!profile) return;
    listNotificationsFor(profile.uid).then(setItems as any);
  }, [profile]);

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.message}>{item.message}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No notifications yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A", padding: 20 },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginBottom: 10 },
  title: { color: "#fff", fontWeight: "700" },
  message: { color: "#94A3B8", marginTop: 6 },
  empty: { color: "#64748B", textAlign: "center", marginTop: 40 },
});
