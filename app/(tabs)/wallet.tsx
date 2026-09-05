import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, Pressable, TextInput, Alert, Modal, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { myTransactions, initializeDeposit, verifyDeposit } from "@/services/wallet";
import { FadeInView } from "@/components/FadeInView";
import { WalletTransaction } from "@/types";
import * as WebBrowser from "expo-web-browser";

export default function Wallet() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const [txns, setTxns] = useState<WalletTransaction[]>([]);
  const [showDeposit, setShowDeposit] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setTxns((await myTransactions(profile.uid)) as WalletTransaction[]);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  async function onDeposit() {
    const amt = parseFloat(amount);
    if (!amt || amt < 3 || amt > 2000) {
      return Alert.alert("Invalid Amount", "Please enter an amount between 3 and 2000 GH₵.");
    }
    setBusy(true);
    try {
      const payUrl = `https://coursearena.great-site.net/pay.php?amount=${amt}&uid=${profile.uid}&email=${encodeURIComponent(profile.email || "user@coursearena.com")}`;
      
      // Opens the InfinityFree PHP script which handles Aesir security and redirects to Paystack
      await WebBrowser.openAuthSessionAsync(payUrl, "coursearena://wallet");
      
      // When Paystack finishes, verify.php will redirect back to coursearena://wallet and close the browser.
      // We just need to reload the balance now!
      Alert.alert("Check Complete", "If your payment was successful, your balance has been updated.");
      load();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Please try again.");
    } finally {
      setBusy(false);
      setAmount("");
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <FadeInView style={styles.container}>
      <View style={[styles.balanceCard, { shadowColor: colors.shadow }]}>
        <Text style={styles.balanceLabel}>Wallet balance</Text>
        <Text style={styles.balanceAmount}>GH₵{(profile?.balance ?? 0).toFixed(2)}</Text>
        <Pressable style={styles.topUpBtn} onPress={() => setShowDeposit(true)}>
          <Text style={styles.topUpText}>Top up</Text>
        </Pressable>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Transaction history</Text>
      <FlatList
        data={txns}
        keyExtractor={(t) => t.id}
        onRefresh={load}
        refreshing={false}
        renderItem={({ item }) => (
          <View style={[styles.txnRow, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
            <View>
              <Text style={[styles.txnDesc, { color: colors.text }]}>{item.description}</Text>
              <Text style={[styles.txnType, { color: colors.textDim }]}>{item.type.replace("_", " ")}</Text>
            </View>
            <Text style={[styles.txnAmount, { color: item.amount >= 0 ? "#22C55E" : "#F87171" }]}>
              {item.amount >= 0 ? "+" : ""}GH₵{item.amount.toFixed(2)}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={[styles.empty, { color: colors.textDim }]}>No transactions yet.</Text>}
      />

      <Modal visible={showDeposit} transparent animationType="slide" onRequestClose={() => setShowDeposit(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalBackdrop}>
              <TouchableWithoutFeedback>
                <View style={[styles.modalCard, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Top up wallet</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                    placeholder="Amount (GH₵)"
                    placeholderTextColor={colors.textDim}
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={setAmount}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                  <Pressable style={[styles.topUpBtn, { backgroundColor: colors.primary }]} onPress={onDeposit} disabled={busy}>
                    <Text style={[styles.topUpText, { color: "#FFFFFF" }]}>{busy ? "Opening Paystack..." : "Continue"}</Text>
                  </Pressable>
                  <Pressable onPress={() => { setShowDeposit(false); Keyboard.dismiss(); }} style={{ marginTop: 12 }}>
                    <Text style={{ color: colors.textDim, textAlign: "center", padding: 10 }}>Cancel</Text>
                  </Pressable>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </FadeInView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  balanceCard: { backgroundColor: "#4338B8", borderRadius: 18, padding: 20, marginTop: 8, marginBottom: 24, shadowColor: "#4338B8", shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  balanceLabel: { color: "#E0E7FF", fontSize: 14 },
  balanceAmount: { color: "#FFFFFF", fontSize: 32, fontWeight: "800", marginTop: 4 },
  topUpBtn: { backgroundColor: "#FFFFFF", borderRadius: 10, paddingVertical: 10, alignItems: "center", marginTop: 16 },
  topUpText: { color: "#4338B8", fontWeight: "700" },
  sectionTitle: { color: "#0F172A", fontSize: 16, fontWeight: "700", marginBottom: 12 },
  txnRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  txnDesc: { color: "#0F172A", fontWeight: "600" },
  txnType: { color: "#64748B", marginTop: 4, fontSize: 12, textTransform: "capitalize" },
  txnAmount: { fontWeight: "700" },
  empty: { color: "#94A3B8", textAlign: "center", marginTop: 20 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10 },
  modalTitle: { color: "#0F172A", fontSize: 18, fontWeight: "700", marginBottom: 16 },
  input: { backgroundColor: "#F1F5F9", color: "#0F172A", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E2E8F0" },
});
