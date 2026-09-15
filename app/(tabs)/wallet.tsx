import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  myTransactions,
  giftMoneyToUser,
  findUserByUsername,
  clearMyTransactions,
} from "@/services/wallet";
import {
  listenToPlatformFeatures,
  PlatformFeatures,
} from "@/services/platformFeatures";
import { FadeInView } from "@/components/FadeInView";
import { WalletTransaction } from "@/types";
import {
  chargeMobileMoney,
  submitPaymentOtp,
  verifyPayment,
  detectMoMoProvider,
  formatGhanaPhone,
  chargeCard,
  submitPaymentPin,
  MoMoProvider,
} from "@/services/paymentService";

const QUICK_AMOUNTS = [5, 10, 20, 50, 100, 200];
const PENDING_DEPOSIT_STORAGE_KEY = "@pending_momo_deposit";

const PROVIDERS: { id: MoMoProvider; name: string; color: string; badge: string }[] = [
  { id: "mtn", name: "MTN MoMo", color: "#F59E0B", badge: "MTN" },
  { id: "vod", name: "Telecel Cash", color: "#EF4444", badge: "Telecel" },
  { id: "tgo", name: "AT Money", color: "#3B82F6", badge: "AT" },
];

export default function Wallet() {
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();
  const [txns, setTxns] = useState<WalletTransaction[]>([]);
  const [features, setFeatures] = useState<PlatformFeatures>({
    enableGifting: true,
    enableChat: true,
  });

  // Top-up Modal State
  const [showDeposit, setShowDeposit] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"momo" | "card">("momo");
  const [depositStep, setDepositStep] = useState<"input" | "otp" | "card_pin" | "authorizing" | "success">("input");
  const [amount, setAmount] = useState("");
  
  // MoMo inputs
  const [phone, setPhone] = useState("");
  const [provider, setProvider] = useState<MoMoProvider>("mtn");

  // Card inputs
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardPin, setCardPin] = useState("");

  // Common verification state
  const [otp, setOtp] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [creditedAmount, setCreditedAmount] = useState(0);
  const [creditedBalance, setCreditedBalance] = useState(0);

  // In-App 3DS WebView Modal
  const [threeDsUrl, setThreeDsUrl] = useState<string | null>(null);

  // Gift a Friend State
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftUsername, setGiftUsername] = useState("");
  const [giftAmount, setGiftAmount] = useState("");
  const [giftNote, setGiftNote] = useState("");
  const [recipientProfile, setRecipientProfile] = useState<any>(null);
  const [searchingRecipient, setSearchingRecipient] = useState(false);
  const [giftingBusy, setGiftingBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | "topup" | "gifts" | "purchases">("all");

  function formatTxnDate(val: any): string {
    if (!val) return "Recent";
    let date: Date;
    if (val.toDate && typeof val.toDate === "function") {
      date = val.toDate();
    } else if (val.seconds) {
      date = new Date(val.seconds * 1000);
    } else {
      date = new Date(val);
    }
    if (isNaN(date.getTime())) return "Recent";
    const day = date.getDate();
    const month = date.toLocaleString("en-US", { month: "short" });
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
  }

  // Polling ref
  const pollIntervalRef = useRef<any>(null);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      const list = await myTransactions(profile.uid);
      setTxns(list as WalletTransaction[]);
    } catch (e) {
      console.error("Failed to load transactions:", e);
    }
  }, [profile]);

  useEffect(() => {
    load();
    const unsub = listenToPlatformFeatures(setFeatures);
    return () => unsub();
  }, [load]);

  // Check for unfinished/pending deposits on mount (Auto-Recovery)
  useEffect(() => {
    async function recoverPendingDeposit() {
      if (!profile?.uid) return;
      try {
        const stored = await AsyncStorage.getItem(PENDING_DEPOSIT_STORAGE_KEY);
        if (!stored) return;
        const parsed = JSON.parse(stored);
        if (parsed.uid === profile.uid && parsed.reference) {
          const res = await verifyPayment({ reference: parsed.reference, uid: profile.uid });
          if (res.success && res.status === "success") {
            await AsyncStorage.removeItem(PENDING_DEPOSIT_STORAGE_KEY);
            load();
            Alert.alert(
              "Payment Confirmed",
              `Your pending deposit of GH₵${(res.amount || parsed.amount || 0).toFixed(2)} was successfully processed and credited!`
            );
          }
        }
      } catch (err) {
        console.log("Pending deposit check failed:", err);
      }
    }
    recoverPendingDeposit();
  }, [profile?.uid, load]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  function resetModal() {
    stopPolling();
    setDepositStep("input");
    setAmount("");
    setPhone("");
    setProvider("mtn");
    setCardNumber("");
    setCardExpiry("");
    setCardCvv("");
    setCardPin("");
    setOtp("");
    setPaymentRef("");
    setStatusMessage("");
    setThreeDsUrl(null);
    setBusy(false);
  }

  // Safety Cancel / Close handler: Auto-verify so the user never loses money
  async function handleCloseModal() {
    stopPolling();
    // If user was waiting for authorization or had a pending reference, auto-check payment status
    if (paymentRef && (depositStep === "authorizing" || depositStep === "otp" || depositStep === "card_pin")) {
      try {
        if (profile?.uid) {
          const res = await verifyPayment({ reference: paymentRef, uid: profile.uid });
          if (res.success && res.status === "success") {
            await AsyncStorage.removeItem(PENDING_DEPOSIT_STORAGE_KEY);
            const amt = res.amount || parseFloat(amount) || 0;
            setCreditedAmount(amt);
            setCreditedBalance(res.new_balance || (profile.balance || 0) + amt);
            setDepositStep("success");
            load();
            Alert.alert(
              "Payment Succeeded",
              `Your payment was approved! GH₵${amt.toFixed(2)} has been added to your wallet balance.`
            );
            return;
          }
        }
      } catch {
        // Fallback: keep pending storage key so next app start checks it
      }
    }
    setShowDeposit(false);
    resetModal();
  }

  function onPhoneChange(text: string) {
    setPhone(text);
    const cleaned = formatGhanaPhone(text);
    if (cleaned.length >= 3) {
      const detected = detectMoMoProvider(cleaned);
      setProvider(detected);
    }
  }

  function formatCardNumberInput(text: string) {
    const cleaned = text.replace(/[^0-9]/g, "").substring(0, 16);
    const parts = cleaned.match(/.{1,4}/g);
    setCardNumber(parts ? parts.join(" ") : cleaned);
  }

  function formatExpiryInput(text: string) {
    const cleaned = text.replace(/[^0-9]/g, "").substring(0, 4);
    if (cleaned.length >= 3) {
      setCardExpiry(`${cleaned.substring(0, 2)}/${cleaned.substring(2, 4)}`);
    } else {
      setCardExpiry(cleaned);
    }
  }

  // STEP 1A: Direct Mobile Money Charge
  async function startMoMoDeposit() {
    if (!profile) {
      return Alert.alert("Not Signed In", "Please sign in to top up your wallet.");
    }
    const amt = parseFloat(amount);
    if (!amt || amt < 0.01 || amt > 5000) {
      return Alert.alert("Invalid Amount", "Please enter an amount of at least 0.01 GH₵.");
    }
    const cleanPhone = formatGhanaPhone(phone);
    if (cleanPhone.length < 10) {
      return Alert.alert(
        "Invalid Phone Number",
        "Please enter a valid 10-digit Ghana mobile number (e.g. 055 123 4567)."
      );
    }

    Keyboard.dismiss();
    setBusy(true);
    try {
      const res = await chargeMobileMoney({
        amount: amt,
        phone: cleanPhone,
        provider,
        email: profile.email || "user@coursearena.com",
        uid: profile.uid,
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to initiate payment.");
      }

      setPaymentRef(res.reference);

      // Store pending reference to guard against accidental app kills/cancellations
      await AsyncStorage.setItem(
        PENDING_DEPOSIT_STORAGE_KEY,
        JSON.stringify({ reference: res.reference, amount: amt, uid: profile.uid, time: Date.now() })
      );

      if (res.status === "success") {
        await AsyncStorage.removeItem(PENDING_DEPOSIT_STORAGE_KEY);
        setCreditedAmount(amt);
        setCreditedBalance(res.new_balance || (profile.balance || 0) + amt);
        setDepositStep("success");
        load();
      } else if (res.status === "send_otp") {
        setStatusMessage(res.message || "Please enter the authorization code sent to your phone.");
        setDepositStep("otp");
      } else if (res.status === "pay_offline" || res.status === "pending") {
        setStatusMessage(
          res.message ||
            `A payment prompt has been sent to ${cleanPhone}. Please enter your Mobile Money PIN on your phone to approve.`
        );
        setDepositStep("authorizing");
        startPollingVerification(res.reference);
      }
    } catch (e: any) {
      Alert.alert("Payment Failed", e.message || "Could not process charge. Please check your phone number.");
    } finally {
      setBusy(false);
    }
  }

  // STEP 1B: Direct In-App Card Charge
  async function startCardDeposit() {
    if (!profile) {
      return Alert.alert("Not Signed In", "Please sign in to top up your wallet.");
    }
    const amt = parseFloat(amount);
    if (!amt || amt < 0.01 || amt > 5000) {
      return Alert.alert("Invalid Amount", "Please enter an amount of at least 0.01 GH₵.");
    }
    const cleanNum = cardNumber.replace(/\s+/g, "");
    if (cleanNum.length < 12) {
      return Alert.alert("Invalid Card Number", "Please enter a valid 16-digit card number.");
    }
    const expParts = cardExpiry.split("/");
    const expMonth = expParts[0]?.trim();
    const expYear = expParts[1]?.trim();
    if (!expMonth || !expYear || expMonth.length < 2 || expYear.length < 2) {
      return Alert.alert("Invalid Expiry Date", "Please enter a valid expiry date (MM/YY).");
    }
    if (cardCvv.trim().length < 3) {
      return Alert.alert("Invalid CVV", "Please enter the 3 or 4 digit security code on the back of your card.");
    }

    Keyboard.dismiss();
    setBusy(true);
    try {
      const fullYear = expYear.length === 2 ? `20${expYear}` : expYear;
      const res = await chargeCard({
        amount: amt,
        cardNumber: cleanNum,
        cvv: cardCvv.trim(),
        expiryMonth: expMonth,
        expiryYear: fullYear,
        email: profile.email || "user@coursearena.com",
        uid: profile.uid,
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to process card payment.");
      }

      setPaymentRef(res.reference);
      await AsyncStorage.setItem(
        PENDING_DEPOSIT_STORAGE_KEY,
        JSON.stringify({ reference: res.reference, amount: amt, uid: profile.uid, time: Date.now() })
      );

      if (res.status === "success") {
        await AsyncStorage.removeItem(PENDING_DEPOSIT_STORAGE_KEY);
        setCreditedAmount(amt);
        setCreditedBalance(res.new_balance || (profile.balance || 0) + amt);
        setDepositStep("success");
        load();
      } else if (res.status === "send_pin") {
        setStatusMessage(res.message || "Please enter your 4-digit card PIN.");
        setDepositStep("card_pin");
      } else if (res.status === "send_otp") {
        setStatusMessage(res.message || "Please enter the OTP sent by your bank.");
        setDepositStep("otp");
      } else if (res.status === "open_url" && res.auth_url) {
        // Bank 3D Secure Web Authentication
        setThreeDsUrl(res.auth_url);
      } else {
        setStatusMessage(res.message || "Card payment is processing...");
        setDepositStep("authorizing");
        startPollingVerification(res.reference);
      }
    } catch (e: any) {
      Alert.alert("Card Payment Error", e.message || "Could not complete card payment.");
    } finally {
      setBusy(false);
    }
  }

  // STEP 2: Submit Card PIN
  async function onSubmitCardPin() {
    if (!profile || !paymentRef || !cardPin.trim()) {
      return Alert.alert("Required", "Please enter your card PIN.");
    }
    Keyboard.dismiss();
    setBusy(true);
    try {
      const res = await submitPaymentPin({
        reference: paymentRef,
        pin: cardPin.trim(),
        uid: profile.uid,
        amount: parseFloat(amount),
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to submit PIN.");
      }

      if (res.status === "success") {
        await AsyncStorage.removeItem(PENDING_DEPOSIT_STORAGE_KEY);
        const amt = res.amount || parseFloat(amount);
        setCreditedAmount(amt);
        setCreditedBalance(res.new_balance || (profile.balance || 0) + amt);
        setDepositStep("success");
        load();
      } else if (res.status === "send_otp") {
        setStatusMessage(res.message || "Please enter the OTP sent by your bank.");
        setDepositStep("otp");
      } else if (res.status === "open_url" && res.auth_url) {
        setThreeDsUrl(res.auth_url);
      } else {
        setStatusMessage(res.message || "Payment submitted. Waiting for confirmation...");
        setDepositStep("authorizing");
        startPollingVerification(paymentRef);
      }
    } catch (e: any) {
      Alert.alert("PIN Error", e.message || "Incorrect PIN or payment failed.");
    } finally {
      setBusy(false);
    }
  }

  // STEP 3: Submit OTP
  async function onSubmitOtp() {
    if (!profile || !paymentRef || !otp.trim()) {
      return Alert.alert("Required", "Please enter the verification code sent to your phone/email.");
    }
    Keyboard.dismiss();
    setBusy(true);
    try {
      const res = await submitPaymentOtp({
        reference: paymentRef,
        otp: otp.trim(),
        uid: profile.uid,
        amount: parseFloat(amount),
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to verify OTP.");
      }

      if (res.status === "success") {
        await AsyncStorage.removeItem(PENDING_DEPOSIT_STORAGE_KEY);
        const amt = res.amount || parseFloat(amount);
        setCreditedAmount(amt);
        setCreditedBalance(res.new_balance || (profile.balance || 0) + amt);
        setDepositStep("success");
        load();
      } else if (res.status === "pending" || res.status === "pay_offline") {
        setStatusMessage(res.message || "Payment submitted. Waiting for confirmation...");
        setDepositStep("authorizing");
        startPollingVerification(paymentRef);
      }
    } catch (e: any) {
      Alert.alert("OTP Error", e.message || "Incorrect verification code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // STEP 4: Poll verification for USSD prompt or card approval
  function startPollingVerification(reference: string) {
    stopPolling();
    let attempts = 0;
    const maxAttempts = 35; // 35 * 3s = 105s

    pollIntervalRef.current = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        stopPolling();
        setStatusMessage("Approval timed out. If you entered your PIN, tap 'Check Status' below.");
        return;
      }

      try {
        if (!profile) return;
        const res = await verifyPayment({ reference, uid: profile.uid });
        if (res.success && res.status === "success") {
          stopPolling();
          await AsyncStorage.removeItem(PENDING_DEPOSIT_STORAGE_KEY);
          const amt = res.amount || parseFloat(amount);
          setCreditedAmount(amt);
          setCreditedBalance(res.new_balance || (profile.balance || 0) + amt);
          setDepositStep("success");
          load();
        }
      } catch {
        // Continue polling
      }
    }, 3000);
  }

  // Immediate Manual Check
  async function checkManualStatus() {
    if (!profile || !paymentRef) return;
    setBusy(true);
    try {
      const res = await verifyPayment({ reference: paymentRef, uid: profile.uid });
      if (res.success && res.status === "success") {
        stopPolling();
        await AsyncStorage.removeItem(PENDING_DEPOSIT_STORAGE_KEY);
        const amt = res.amount || parseFloat(amount);
        setCreditedAmount(amt);
        setCreditedBalance(res.new_balance || (profile.balance || 0) + amt);
        setDepositStep("success");
        load();
      } else {
        Alert.alert(
          "Payment Pending",
          "We haven't received confirmation from the payment network yet. If you have already entered your PIN, please wait a few seconds and check again."
        );
      }
    } catch (e: any) {
      Alert.alert("Status Check", e.message || "Payment still pending.");
    } finally {
      setBusy(false);
    }
  }

  // Handle 3DS Completed or Closed
  async function handleClose3Ds() {
    setThreeDsUrl(null);
    if (paymentRef && profile?.uid) {
      setBusy(true);
      try {
        const res = await verifyPayment({ reference: paymentRef, uid: profile.uid });
        if (res.success && res.status === "success") {
          await AsyncStorage.removeItem(PENDING_DEPOSIT_STORAGE_KEY);
          const amt = res.amount || parseFloat(amount);
          setCreditedAmount(amt);
          setCreditedBalance(res.new_balance || (profile.balance || 0) + amt);
          setDepositStep("success");
          load();
        } else {
          setDepositStep("authorizing");
          startPollingVerification(paymentRef);
        }
      } catch {
        setDepositStep("authorizing");
      } finally {
        setBusy(false);
      }
    }
  }

  // GIFT A FRIEND: Look up username
  async function handleUsernameSearch(text: string) {
    setGiftUsername(text);
    const clean = text.trim().toLowerCase().replace(/^@/, "");
    if (clean.length >= 3) {
      setSearchingRecipient(true);
      try {
        const user = await findUserByUsername(clean);
        setRecipientProfile(user);
      } catch {
        setRecipientProfile(null);
      } finally {
        setSearchingRecipient(false);
      }
    } else {
      setRecipientProfile(null);
    }
  }

  // GIFT A FRIEND: Send Money
  async function handleSendGift() {
    if (!profile) return;
    const clean = giftUsername.trim().toLowerCase().replace(/^@/, "");
    if (!clean) {
      return Alert.alert("Required", "Please enter the recipient's @username.");
    }
    const amt = parseFloat(giftAmount);
    if (!amt || amt <= 0) {
      return Alert.alert("Invalid Amount", "Please enter a valid gift amount.");
    }
    if (amt > (profile.balance || 0)) {
      return Alert.alert(
        "Insufficient Balance",
        `You only have GH₵${(profile.balance || 0).toFixed(2)}. Please top up your wallet first.`
      );
    }

    Alert.alert(
      "Confirm Gift",
      `Are you sure you want to send GH₵${amt.toFixed(2)} to @${clean}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Now",
          onPress: async () => {
            setGiftingBusy(true);
            try {
              await giftMoneyToUser(clean, amt, giftNote);
              setShowGiftModal(false);
              setGiftUsername("");
              setGiftAmount("");
              setGiftNote("");
              setRecipientProfile(null);
              load();
              Alert.alert(
                "Gift Sent Successfully! 🎉",
                `GH₵${amt.toFixed(2)} was delivered to @${clean}.`
              );
            } catch (err: any) {
              Alert.alert("Gift Failed", err.message || "Could not complete transfer.");
            } finally {
              setGiftingBusy(false);
            }
          },
        },
      ]
    );
  }

  // CLEAR TRANSACTION HISTORY
  function handleClearHistory() {
    if (!profile) return;
    if (txns.length === 0) {
      return Alert.alert("Empty History", "You have no transactions to clear.");
    }

    Alert.alert(
      "Clear Wallet History",
      "Are you sure you want to delete all transaction records from your wallet? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              await clearMyTransactions(profile.uid);
              setTxns([]);
              Alert.alert("History Cleared", "Your transaction history has been deleted.");
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to clear transactions.");
            }
          },
        },
      ]
    );
  }

  const filteredTxns = txns.filter((t) => {
    if (filter === "all") return true;
    if (filter === "topup") return t.type === "deposit";
    if (filter === "gifts") return t.type === "gift_sent" || t.type === "gift_received";
    if (filter === "purchases")
      return t.type === "purchase" || (t.amount < 0 && t.type !== "gift_sent");
    return true;
  });

  const bg = isDark ? "#070B14" : colors.background;
  const cardBg = isDark ? "#101625" : colors.card;
  const borderCol = isDark ? "rgba(255,255,255,0.06)" : "#E2E8F0";
  const textColor = isDark ? "#FFFFFF" : "#0F172A";
  const textDimColor = isDark ? "#94A3B8" : "#64748B";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <FadeInView style={styles.container}>
        {/* TOP HEADER */}
        <View style={styles.headerRow}>
          <View style={styles.headerTitleCol}>
            <Text style={[styles.headerMainTitle, { color: textColor }]}>Wallet</Text>
            <Text style={[styles.headerSubtitle, { color: textDimColor }]}>Manage your balance, top up and more</Text>
          </View>
          <Pressable
            style={[
              styles.headerHistoryBtn,
              {
                backgroundColor: isDark ? "#161F30" : "#EEF2F6",
                borderColor: borderCol,
              },
            ]}
            onPress={load}
            hitSlop={8}
          >
            <Ionicons name="time-outline" size={15} color="#818CF8" style={{ marginRight: 5 }} />
            <Text style={[styles.headerHistoryBtnText, { color: textColor }]}>Transaction History</Text>
          </Pressable>
        </View>

        {/* WALLET BALANCE HERO CARD */}
        <View style={[styles.balanceCard, { shadowColor: colors.shadow }]}>
          <View style={styles.balanceTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.balanceLabel}>Wallet balance</Text>
              <Text style={styles.balanceAmount}>GH₵{(profile?.balance ?? 0).toFixed(2)}</Text>
              <Text style={styles.balanceMotto}>Your learning, our priority 💜</Text>
            </View>

            {/* 3D WALLET ILLUSTRATION */}
            <View style={styles.walletIllustrationContainer}>
              <View style={styles.walletGlowCircle}>
                <View style={styles.walletCardBadgeBack} />
                <View style={styles.walletCardBadgeFront} />
                <View style={styles.walletBody}>
                  <View style={styles.walletClasp} />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.heroActionsRow}>
            <Pressable
              style={styles.topUpBtn}
              onPress={() => {
                resetModal();
                setShowDeposit(true);
              }}
            >
              <Ionicons name="add-circle-outline" size={18} color="#4338B8" style={{ marginRight: 6 }} />
              <Text style={styles.topUpText}>Top up</Text>
            </Pressable>

            {features.enableGifting && (
              <Pressable
                style={styles.giftBtn}
                onPress={() => {
                  setShowGiftModal(true);
                  setGiftUsername("");
                  setGiftAmount("");
                  setGiftNote("");
                  setRecipientProfile(null);
                }}
              >
                <Ionicons name="gift-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.giftBtnText}>Gift a Friend</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* SHARE KNOWLEDGE PROMO BANNER */}
        {features.enableGifting && (
          <Pressable
            style={[styles.shareBannerCard, { backgroundColor: cardBg, borderColor: borderCol }]}
            onPress={() => {
              setShowGiftModal(true);
              setGiftUsername("");
              setGiftAmount("");
              setGiftNote("");
              setRecipientProfile(null);
            }}
          >
            <View style={styles.shareBannerIconBox}>
              <Ionicons name="people" size={20} color="#818CF8" />
            </View>
            <View style={styles.shareBannerTextBox}>
              <Text style={[styles.shareBannerTitle, { color: textColor }]}>Share knowledge, change lives</Text>
              <Text style={[styles.shareBannerSub, { color: textDimColor }]}>Gift a friend and help them learn today!</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#64748B" />
          </Pressable>
        )}

        {/* TRANSACTIONS SECTION */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Transaction history</Text>
          <Pressable
            onPress={handleClearHistory}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.clearHistoryText}>Clear</Text>
          </Pressable>
        </View>

        {/* FILTER TABS */}
        <View style={styles.filtersRow}>
          {(
            [
              { id: "all", label: "All" },
              { id: "topup", label: "Top up" },
              { id: "gifts", label: "Gifts" },
              { id: "purchases", label: "Purchases" },
            ] as const
          ).map((tab) => {
            const active = filter === tab.id;
            return (
              <Pressable
                key={tab.id}
                style={[
                  styles.filterTab,
                  active
                    ? styles.filterTabActive
                    : [styles.filterTabInactive, { backgroundColor: cardBg, borderColor: borderCol }],
                ]}
                onPress={() => setFilter(tab.id)}
              >
                <Text
                  style={
                    active
                      ? styles.filterTabTextActive
                      : [styles.filterTabTextInactive, { color: textDimColor }]
                  }
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <FlatList
          data={filteredTxns}
          keyExtractor={(t) => t.id}
          onRefresh={load}
          refreshing={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => {
            const isCredit = item.amount >= 0;
            return (
              <View style={[styles.txnRow, { backgroundColor: cardBg, borderColor: borderCol }]}>
                <View
                  style={[
                    styles.txnIconCircle,
                    {
                      backgroundColor: isCredit
                        ? "rgba(16, 185, 129, 0.12)"
                        : isDark
                        ? "rgba(255, 255, 255, 0.05)"
                        : "rgba(0, 0, 0, 0.05)",
                    },
                  ]}
                >
                  <Ionicons
                    name={isCredit ? "arrow-down" : "arrow-up"}
                    size={18}
                    color={isCredit ? "#10B981" : "#EF4444"}
                  />
                </View>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.txnDesc, { color: textColor }]} numberOfLines={1}>
                    {item.description}
                  </Text>
                  <Text style={[styles.txnType, { color: textDimColor }]}>
                    {item.type === "gift_sent"
                      ? "Gift Sent"
                      : item.type === "gift_received"
                      ? "Gift Received"
                      : item.type === "deposit"
                      ? "Top Up"
                      : "Course Purchase"}
                  </Text>
                  <Text style={[styles.txnDate, { color: textDimColor }]}>{formatTxnDate(item.createdAt)}</Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text
                    style={[
                      styles.txnAmount,
                      { color: isCredit ? "#10B981" : "#EF4444" },
                    ]}
                  >
                    {isCredit ? "+ " : "- "}GH₵ {Math.abs(item.amount).toFixed(2)}
                  </Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      Alert.alert(
                        "Transaction Details",
                        `Description: ${item.description}\nType: ${item.type.replace("_", " ").toUpperCase()}\nAmount: GH₵ ${Math.abs(item.amount).toFixed(2)}\nDate: ${formatTxnDate(item.createdAt)}`
                      );
                    }}
                  >
                    <Ionicons name="ellipsis-vertical" size={16} color="#64748B" />
                  </Pressable>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={40} color="#64748B" style={{ opacity: 0.4 }} />
              <Text style={[styles.empty, { color: "#94A3B8" }]}>No transactions found.</Text>
            </View>
          }
        />

        {/* IN-APP PAYMENT TOP-UP MODAL */}
        <Modal
          visible={showDeposit}
          transparent
          animationType="slide"
          onRequestClose={handleCloseModal}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.modalBackdrop}>
                <TouchableWithoutFeedback>
                  <View
                    style={[
                      styles.modalCard,
                      { backgroundColor: colors.card, shadowColor: colors.shadow },
                    ]}
                  >
                    {/* MODAL HEADER */}
                    <View style={styles.modalHeader}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={styles.momoIconCircle}>
                          <Ionicons
                            name={paymentMethod === "momo" ? "phone-portrait-outline" : "card-outline"}
                            size={20}
                            color="#4F46E5"
                          />
                        </View>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>
                          {depositStep === "input" && "Top Up Wallet"}
                          {depositStep === "otp" && "Verify OTP"}
                          {depositStep === "card_pin" && "Enter Card PIN"}
                          {depositStep === "authorizing" && "Authorizing Payment"}
                          {depositStep === "success" && "Top-Up Complete"}
                        </Text>
                      </View>
                      <Pressable onPress={handleCloseModal} style={styles.closeBtn}>
                        <Ionicons name="close" size={22} color={colors.textDim} />
                      </Pressable>
                    </View>

                    <ScrollView
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                    >
                      {/* STEP 1: INPUT DETAILS */}
                      {depositStep === "input" && (
                        <View style={{ marginTop: 8 }}>
                          {/* METHOD TABS (MoMo vs Card) */}
                          <View style={[styles.methodTabsRow, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F1F5F9" }]}>
                            <Pressable
                              style={[
                                styles.methodTab,
                                paymentMethod === "momo" && [styles.methodTabActive, { backgroundColor: colors.card }],
                              ]}
                              onPress={() => setPaymentMethod("momo")}
                            >
                              <Ionicons
                                name="phone-portrait"
                                size={16}
                                color={paymentMethod === "momo" ? colors.primary : colors.textDim}
                              />
                              <Text
                                style={[
                                  styles.methodTabText,
                                  { color: paymentMethod === "momo" ? colors.text : colors.textDim },
                                ]}
                              >
                                Mobile Money
                              </Text>
                            </Pressable>

                            <Pressable
                              style={[
                                styles.methodTab,
                                paymentMethod === "card" && [styles.methodTabActive, { backgroundColor: colors.card }],
                              ]}
                              onPress={() => setPaymentMethod("card")}
                            >
                              <Ionicons
                                name="card"
                                size={16}
                                color={paymentMethod === "card" ? colors.primary : colors.textDim}
                              />
                              <Text
                                style={[
                                  styles.methodTabText,
                                  { color: paymentMethod === "card" ? colors.text : colors.textDim },
                                ]}
                              >
                                Bank Card
                              </Text>
                            </Pressable>
                          </View>

                          {/* AMOUNT INPUT */}
                          <Text style={[styles.inputLabel, { color: colors.textDim, marginTop: 14 }]}>
                            Amount to Deposit (GH₵)
                          </Text>
                          <TextInput
                            style={[
                              styles.input,
                              {
                                backgroundColor: colors.background,
                                color: colors.text,
                                borderColor: colors.border,
                              },
                            ]}
                            placeholder="0.00"
                            placeholderTextColor={colors.textDim}
                            keyboardType="decimal-pad"
                            value={amount}
                            onChangeText={setAmount}
                          />

                          {/* QUICK AMOUNTS */}
                          <View style={styles.quickAmountsRow}>
                            {QUICK_AMOUNTS.map((val) => (
                              <Pressable
                                key={val}
                                style={[
                                  styles.quickChip,
                                  {
                                    backgroundColor:
                                      amount === String(val)
                                        ? colors.primary
                                        : isDark
                                        ? "rgba(255,255,255,0.05)"
                                        : "#F1F5F9",
                                    borderColor:
                                      amount === String(val) ? colors.primary : colors.border,
                                  },
                                ]}
                                onPress={() => setAmount(String(val))}
                              >
                                <Text
                                  style={[
                                    styles.quickChipText,
                                    {
                                      color:
                                        amount === String(val) ? "#FFFFFF" : colors.text,
                                    },
                                  ]}
                                >
                                  +{val}
                                </Text>
                              </Pressable>
                            ))}
                          </View>

                          {/* MOMO SPECIFIC FIELDS */}
                          {paymentMethod === "momo" && (
                            <>
                              <Text style={[styles.inputLabel, { color: colors.textDim, marginTop: 16 }]}>
                                Mobile Network
                              </Text>
                              <View style={styles.providersRow}>
                                {PROVIDERS.map((p) => (
                                  <Pressable
                                    key={p.id}
                                    style={[
                                      styles.providerChip,
                                      {
                                        borderColor:
                                          provider === p.id ? p.color : colors.border,
                                        backgroundColor:
                                          provider === p.id
                                            ? isDark
                                              ? "rgba(255,255,255,0.08)"
                                              : "#F8FAFC"
                                            : colors.background,
                                      },
                                    ]}
                                    onPress={() => setProvider(p.id)}
                                  >
                                    <View
                                      style={[
                                        styles.providerDot,
                                        { backgroundColor: p.color },
                                      ]}
                                    />
                                    <Text
                                      style={[
                                        styles.providerText,
                                        {
                                          color:
                                            provider === p.id ? colors.text : colors.textDim,
                                          fontWeight: provider === p.id ? "700" : "500",
                                        },
                                      ]}
                                    >
                                      {p.name}
                                    </Text>
                                  </Pressable>
                                ))}
                              </View>

                              <Text style={[styles.inputLabel, { color: colors.textDim, marginTop: 16 }]}>
                                Mobile Money Phone Number
                              </Text>
                              <View
                                style={[
                                  styles.phoneInputRow,
                                  {
                                    backgroundColor: colors.background,
                                    borderColor: colors.border,
                                  },
                                ]}
                              >
                                <Text style={[styles.phonePrefix, { color: colors.textDim }]}>
                                  🇬🇭 +233
                                </Text>
                                <TextInput
                                  style={[styles.phoneInput, { color: colors.text }]}
                                  placeholder="055 123 4567"
                                  placeholderTextColor={colors.textDim}
                                  keyboardType="phone-pad"
                                  value={phone}
                                  onChangeText={onPhoneChange}
                                />
                              </View>

                              <Pressable
                                style={[
                                  styles.payBtn,
                                  { backgroundColor: colors.primary, marginTop: 22 },
                                ]}
                                onPress={startMoMoDeposit}
                                disabled={busy}
                              >
                                {busy ? (
                                  <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                    <Ionicons name="phone-portrait-outline" size={18} color="#FFFFFF" />
                                    <Text style={styles.payBtnText}>
                                      Pay GH₵{amount || "0.00"} with MoMo
                                    </Text>
                                  </View>
                                )}
                              </Pressable>
                            </>
                          )}

                          {/* IN-APP CARD SPECIFIC FIELDS */}
                          {paymentMethod === "card" && (
                            <>
                              <Text style={[styles.inputLabel, { color: colors.textDim, marginTop: 16 }]}>
                                Card Number
                              </Text>
                              <View
                                style={[
                                  styles.cardInputRow,
                                  {
                                    backgroundColor: colors.background,
                                    borderColor: colors.border,
                                  },
                                ]}
                              >
                                <Ionicons name="card-outline" size={20} color={colors.textDim} style={{ marginRight: 8 }} />
                                <TextInput
                                  style={[styles.phoneInput, { color: colors.text }]}
                                  placeholder="1234 5678 9012 3456"
                                  placeholderTextColor={colors.textDim}
                                  keyboardType="number-pad"
                                  maxLength={19}
                                  value={cardNumber}
                                  onChangeText={formatCardNumberInput}
                                />
                              </View>

                              <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.inputLabel, { color: colors.textDim }]}>
                                    Expiry Date
                                  </Text>
                                  <TextInput
                                    style={[
                                      styles.input,
                                      {
                                        backgroundColor: colors.background,
                                        color: colors.text,
                                        borderColor: colors.border,
                                      },
                                    ]}
                                    placeholder="MM/YY"
                                    placeholderTextColor={colors.textDim}
                                    keyboardType="number-pad"
                                    maxLength={5}
                                    value={cardExpiry}
                                    onChangeText={formatExpiryInput}
                                  />
                                </View>

                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.inputLabel, { color: colors.textDim }]}>
                                    CVV
                                  </Text>
                                  <TextInput
                                    style={[
                                      styles.input,
                                      {
                                        backgroundColor: colors.background,
                                        color: colors.text,
                                        borderColor: colors.border,
                                      },
                                    ]}
                                    placeholder="123"
                                    placeholderTextColor={colors.textDim}
                                    keyboardType="number-pad"
                                    maxLength={4}
                                    secureTextEntry
                                    value={cardCvv}
                                    onChangeText={setCardCvv}
                                  />
                                </View>
                              </View>

                              <View style={styles.securityBadge}>
                                <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                                <Text style={{ color: colors.textDim, fontSize: 11, marginLeft: 4 }}>
                                  Bank-grade 256-bit encryption. Safe & direct checkout.
                                </Text>
                              </View>

                              <Pressable
                                style={[
                                  styles.payBtn,
                                  { backgroundColor: colors.primary, marginTop: 18 },
                                ]}
                                onPress={startCardDeposit}
                                disabled={busy}
                              >
                                {busy ? (
                                  <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                    <Ionicons name="lock-closed-outline" size={18} color="#FFFFFF" />
                                    <Text style={styles.payBtnText}>
                                      Pay GH₵{amount || "0.00"} Securely
                                    </Text>
                                  </View>
                                )}
                              </Pressable>
                            </>
                          )}
                        </View>
                      )}

                      {/* STEP 2: CARD PIN INPUT */}
                      {depositStep === "card_pin" && (
                        <View style={{ alignItems: "center", paddingVertical: 16 }}>
                          <View style={styles.otpIconCircle}>
                            <Ionicons name="keypad" size={32} color="#4F46E5" />
                          </View>
                          <Text style={[styles.stepTitle, { color: colors.text }]}>
                            Enter Card PIN
                          </Text>
                          <Text style={[styles.stepSubtitle, { color: colors.textDim }]}>
                            {statusMessage || "Please enter your 4-digit card PIN to authorize payment."}
                          </Text>

                          <TextInput
                            style={[
                              styles.otpInput,
                              {
                                backgroundColor: colors.background,
                                color: colors.text,
                                borderColor: colors.border,
                              },
                            ]}
                            placeholder="••••"
                            placeholderTextColor={colors.textDim}
                            keyboardType="number-pad"
                            maxLength={4}
                            secureTextEntry
                            value={cardPin}
                            onChangeText={setCardPin}
                            autoFocus
                          />

                          <Pressable
                            style={[styles.payBtn, { backgroundColor: colors.primary, width: "100%", marginTop: 20 }]}
                            onPress={onSubmitCardPin}
                            disabled={busy}
                          >
                            {busy ? (
                              <ActivityIndicator color="#FFFFFF" />
                            ) : (
                              <Text style={styles.payBtnText}>Authorize Card</Text>
                            )}
                          </Pressable>

                          <Pressable
                            onPress={() => setDepositStep("input")}
                            style={{ marginTop: 14 }}
                          >
                            <Text style={{ color: colors.textDim, fontSize: 13 }}>← Back to card details</Text>
                          </Pressable>
                        </View>
                      )}

                      {/* STEP 3: OTP VERIFICATION */}
                      {depositStep === "otp" && (
                        <View style={{ alignItems: "center", paddingVertical: 16 }}>
                          <View style={styles.otpIconCircle}>
                            <Ionicons name="lock-closed" size={32} color="#F59E0B" />
                          </View>
                          <Text style={[styles.stepTitle, { color: colors.text }]}>
                            Enter Verification OTP
                          </Text>
                          <Text style={[styles.stepSubtitle, { color: colors.textDim }]}>
                            {statusMessage || "Enter the authorization code sent to your phone/email."}
                          </Text>

                          <TextInput
                            style={[
                              styles.otpInput,
                              {
                                backgroundColor: colors.background,
                                color: colors.text,
                                borderColor: colors.border,
                              },
                            ]}
                            placeholder="123456"
                            placeholderTextColor={colors.textDim}
                            keyboardType="number-pad"
                            maxLength={8}
                            value={otp}
                            onChangeText={setOtp}
                            autoFocus
                          />

                          <Pressable
                            style={[styles.payBtn, { backgroundColor: colors.primary, width: "100%", marginTop: 20 }]}
                            onPress={onSubmitOtp}
                            disabled={busy}
                          >
                            {busy ? (
                              <ActivityIndicator color="#FFFFFF" />
                            ) : (
                              <Text style={styles.payBtnText}>Verify & Complete Payment</Text>
                            )}
                          </Pressable>

                          <Pressable
                            onPress={() => setDepositStep("input")}
                            style={{ marginTop: 14 }}
                          >
                            <Text style={{ color: colors.textDim, fontSize: 13 }}>← Back</Text>
                          </Pressable>
                        </View>
                      )}

                      {/* STEP 4: AUTHORIZING / USSD PROMPT */}
                      {depositStep === "authorizing" && (
                        <View style={{ alignItems: "center", paddingVertical: 20 }}>
                          <View style={styles.authorizingCircle}>
                            <Ionicons name="phone-portrait" size={36} color="#4F46E5" />
                          </View>
                          <Text style={[styles.stepTitle, { color: colors.text }]}>
                            Check Your Phone!
                          </Text>
                          <Text style={[styles.stepSubtitle, { color: colors.textDim }]}>
                            {statusMessage}
                          </Text>

                          <View style={styles.loaderRow}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={{ color: colors.textDim, fontSize: 13 }}>
                              Waiting for network approval...
                            </Text>
                          </View>

                          <Pressable
                            style={[styles.payBtn, { backgroundColor: colors.primary, width: "100%", marginTop: 24 }]}
                            onPress={checkManualStatus}
                            disabled={busy}
                          >
                            {busy ? (
                              <ActivityIndicator color="#FFFFFF" />
                            ) : (
                              <Text style={styles.payBtnText}>I Have Entered My PIN</Text>
                            )}
                          </Pressable>

                          <Pressable onPress={handleCloseModal} style={{ marginTop: 14 }}>
                            <Text style={{ color: "#EF4444", fontSize: 13, fontWeight: "600" }}>
                              Done / Close
                            </Text>
                          </Pressable>
                        </View>
                      )}

                      {/* STEP 5: SUCCESS */}
                      {depositStep === "success" && (
                        <View style={{ alignItems: "center", paddingVertical: 20 }}>
                          <View style={styles.successIconCircle}>
                            <Ionicons name="checkmark" size={42} color="#10B981" />
                          </View>
                          <Text style={[styles.stepTitle, { color: colors.text }]}>
                            Top-Up Successful!
                          </Text>
                          <Text style={[styles.stepSubtitle, { color: colors.textDim }]}>
                            GH₵{creditedAmount.toFixed(2)} has been credited to your wallet balance.
                          </Text>

                          <View
                            style={[
                              styles.newBalanceCard,
                              { backgroundColor: isDark ? "rgba(16, 185, 129, 0.1)" : "#ECFDF5", borderColor: "#10B981" },
                            ]}
                          >
                            <Text style={{ color: colors.textDim, fontSize: 12 }}>New Wallet Balance</Text>
                            <Text style={{ color: "#10B981", fontSize: 24, fontWeight: "800", marginTop: 4 }}>
                              GH₵{creditedBalance.toFixed(2)}
                            </Text>
                          </View>

                          <Pressable
                            style={[styles.payBtn, { backgroundColor: "#10B981", width: "100%", marginTop: 20 }]}
                            onPress={handleCloseModal}
                          >
                            <Text style={styles.payBtnText}>Done</Text>
                          </Pressable>
                        </View>
                      )}
                    </ScrollView>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </Modal>

        {/* IN-APP 3D SECURE MODAL (Hides backend endpoints) */}
        <Modal
          visible={!!threeDsUrl}
          animationType="slide"
          onRequestClose={handleClose3Ds}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: "#0F172A" }}>
            <View style={styles.threeDsHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="shield-checkmark" size={20} color="#10B981" />
                <Text style={styles.threeDsTitle}>Bank 3D Secure Authentication</Text>
              </View>
              <Pressable onPress={handleClose3Ds} style={styles.threeDsCloseBtn}>
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </Pressable>
            </View>
            {threeDsUrl && (
              <WebView
                source={{ uri: threeDsUrl }}
                style={{ flex: 1 }}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                onError={() => {}}
                renderError={() => (
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        backgroundColor: "#070B14",
                        justifyContent: "center",
                        alignItems: "center",
                        padding: 24,
                        zIndex: 10,
                      },
                    ]}
                  >
                    <Ionicons name="alert-circle-outline" size={48} color="#EF4444" style={{ marginBottom: 12 }} />
                    <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700", marginBottom: 6, textAlign: "center" }}>
                      Authentication Error
                    </Text>
                    <Text style={{ color: "#94A3B8", fontSize: 13, textAlign: "center", marginBottom: 20 }}>
                      Unable to connect to your bank's 3D Secure server. Please check your internet or try another payment method.
                    </Text>
                    <Pressable
                      style={{ backgroundColor: "#6366F1", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 }}
                      onPress={handleClose3Ds}
                    >
                      <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 14 }}>Close & Return</Text>
                    </Pressable>
                  </View>
                )}
                renderLoading={() => (
                  <View style={styles.webViewLoader}>
                    <ActivityIndicator size="large" color="#6366F1" />
                    <Text style={{ color: "#94A3B8", marginTop: 10, fontSize: 13 }}>
                      Connecting to bank security...
                    </Text>
                  </View>
                )}
                onNavigationStateChange={(navState) => {
                  // If bank redirects to completion or callback
                  if (navState.url.includes("verify.php") || navState.url.includes("success") || navState.url.includes("callback")) {
                    handleClose3Ds();
                  }
                }}
              />
            )}
          </SafeAreaView>
        </Modal>

        {/* GIFT A FRIEND MODAL */}
        <Modal
          visible={showGiftModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowGiftModal(false)}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.modalBackdrop}>
                <TouchableWithoutFeedback>
                  <View
                    style={[
                      styles.modalCard,
                      { backgroundColor: colors.card, shadowColor: colors.shadow },
                    ]}
                  >
                    <View style={styles.modalHeader}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={[styles.momoIconCircle, { backgroundColor: "rgba(139, 92, 246, 0.15)" }]}>
                          <Ionicons name="gift" size={20} color="#8B5CF6" />
                        </View>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>
                          Gift a Friend Money
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => setShowGiftModal(false)}
                        style={styles.closeBtn}
                      >
                        <Ionicons name="close" size={22} color={colors.textDim} />
                      </Pressable>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                      <Text style={[styles.inputLabel, { color: colors.textDim, marginTop: 8 }]}>
                        Recipient Username
                      </Text>
                      <View
                        style={[
                          styles.phoneInputRow,
                          {
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.phonePrefix, { color: colors.primary }]}>@</Text>
                        <TextInput
                          style={[styles.phoneInput, { color: colors.text }]}
                          placeholder="username"
                          placeholderTextColor={colors.textDim}
                          autoCapitalize="none"
                          value={giftUsername}
                          onChangeText={handleUsernameSearch}
                        />
                        {searchingRecipient && (
                          <ActivityIndicator size="small" color={colors.primary} />
                        )}
                      </View>

                      {recipientProfile ? (
                        <View style={[styles.foundUserCard, { backgroundColor: isDark ? "rgba(16, 185, 129, 0.1)" : "#ECFDF5" }]}>
                          <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                          <Text style={{ color: "#10B981", fontWeight: "700", fontSize: 13 }}>
                            Found: {recipientProfile.fullName || recipientProfile.username} (@{recipientProfile.username})
                          </Text>
                        </View>
                      ) : giftUsername.trim().length >= 3 && !searchingRecipient ? (
                        <Text style={{ color: "#EF4444", fontSize: 12, marginTop: 4, marginLeft: 4 }}>
                          User not found. Check username.
                        </Text>
                      ) : null}

                      <Text style={[styles.inputLabel, { color: colors.textDim, marginTop: 14 }]}>
                        Amount to Gift (GH₵)
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: colors.background,
                            color: colors.text,
                            borderColor: colors.border,
                          },
                        ]}
                        placeholder="0.00"
                        placeholderTextColor={colors.textDim}
                        keyboardType="decimal-pad"
                        value={giftAmount}
                        onChangeText={setGiftAmount}
                      />

                      <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 4 }}>
                        Available Balance: GH₵{(profile?.balance || 0).toFixed(2)}
                      </Text>

                      <Text style={[styles.inputLabel, { color: colors.textDim, marginTop: 14 }]}>
                        Personal Note (Optional)
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: colors.background,
                            color: colors.text,
                            borderColor: colors.border,
                          },
                        ]}
                        placeholder="e.g. Here is some cash for your courses!"
                        placeholderTextColor={colors.textDim}
                        value={giftNote}
                        onChangeText={setGiftNote}
                        maxLength={80}
                      />

                      <Pressable
                        style={[
                          styles.payBtn,
                          { backgroundColor: "#8B5CF6", marginTop: 22 },
                        ]}
                        onPress={handleSendGift}
                        disabled={giftingBusy}
                      >
                        {giftingBusy ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Ionicons name="send" size={18} color="#FFFFFF" />
                            <Text style={styles.payBtnText}>
                              Send GH₵{giftAmount || "0.00"} Gift
                            </Text>
                          </View>
                        )}
                      </Pressable>
                    </ScrollView>
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  headerTitleCol: {
    flex: 1,
  },
  headerMainTitle: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 4,
    fontWeight: "400",
  },
  headerHistoryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161F30",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  headerHistoryBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },

  balanceCard: {
    backgroundColor: "#141C2E",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.25)",
    shadowColor: "#6366F1",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  balanceTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  balanceLabel: { color: "#94A3B8", fontSize: 13, fontWeight: "500" },
  balanceAmount: { color: "#FFFFFF", fontSize: 32, fontWeight: "800", marginTop: 4, letterSpacing: -0.5 },
  balanceMotto: { color: "#A5B4FC", fontSize: 13, marginTop: 6, fontWeight: "500" },

  walletIllustrationContainer: {
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
  },
  walletGlowCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(99, 102, 241, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  walletCardBadgeBack: {
    position: "absolute",
    top: 12,
    right: 18,
    width: 28,
    height: 18,
    borderRadius: 4,
    backgroundColor: "#3B82F6",
    transform: [{ rotate: "-15deg" }],
  },
  walletCardBadgeFront: {
    position: "absolute",
    top: 16,
    right: 14,
    width: 28,
    height: 18,
    borderRadius: 4,
    backgroundColor: "#818CF8",
    transform: [{ rotate: "-5deg" }],
  },
  walletBody: {
    width: 44,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    position: "relative",
    marginTop: 14,
    justifyContent: "center",
  },
  walletClasp: {
    position: "absolute",
    right: 4,
    width: 8,
    height: 12,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },

  heroActionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  topUpBtn: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  topUpText: { color: "#4338B8", fontWeight: "700", fontSize: 15 },
  giftBtn: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  giftBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },

  shareBannerCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  shareBannerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(99, 102, 241, 0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  shareBannerTextBox: {
    flex: 1,
  },
  shareBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  shareBannerSub: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 2,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  clearHistoryText: { fontSize: 14, fontWeight: "600", color: "#6366F1" },

  filtersRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  filterTabActive: {
    backgroundColor: "#5B4DF5",
  },
  filterTabInactive: {
    borderWidth: 1,
  },
  filterTabTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  filterTabTextInactive: {
    color: "#94A3B8",
    fontWeight: "500",
    fontSize: 13,
  },

  txnRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  txnIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  txnDesc: { fontWeight: "600", fontSize: 14 },
  txnType: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  txnDate: { color: "#64748B", fontSize: 11, marginTop: 2 },
  txnAmount: { fontWeight: "700", fontSize: 15 },
  emptyContainer: { alignItems: "center", justifyContent: "center", marginTop: 40 },
  empty: { textAlign: "center", marginTop: 8, fontSize: 14 },

  // Modal styles
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "92%",
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  momoIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(79, 70, 229, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  closeBtn: { padding: 4 },

  methodTabsRow: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 4,
    marginBottom: 4,
  },
  methodTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  methodTabActive: {
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  methodTabText: { fontSize: 13, fontWeight: "700" },

  inputLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  input: { borderRadius: 12, padding: 14, borderWidth: 1, fontSize: 16, fontWeight: "600" },

  quickAmountsRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  quickChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  quickChipText: { fontSize: 12, fontWeight: "700" },

  providersRow: { flexDirection: "row", gap: 8 },
  providerChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  providerDot: { width: 8, height: 8, borderRadius: 4 },
  providerText: { fontSize: 12 },

  phoneInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  cardInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  phonePrefix: { fontSize: 14, fontWeight: "700", marginRight: 8 },
  phoneInput: { flex: 1, paddingVertical: 14, fontSize: 16, fontWeight: "600" },

  securityBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingHorizontal: 4,
  },

  payBtn: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  payBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },

  otpIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  authorizingCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(79, 70, 229, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  stepTitle: { fontSize: 20, fontWeight: "800", marginBottom: 6, textAlign: "center" },
  stepSubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20, paddingHorizontal: 16 },
  otpInput: {
    width: "80%",
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 12,
    textAlign: "center",
    fontSize: 24,
    letterSpacing: 8,
    fontWeight: "800",
    marginTop: 20,
  },
  loaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 },
  newBalanceCard: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
  },

  foundUserCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
  },

  threeDsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#1E293B",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  threeDsTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  threeDsCloseBtn: { padding: 4 },
  webViewLoader: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
  },
});
