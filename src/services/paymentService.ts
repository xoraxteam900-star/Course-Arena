import { callInfinityFreeBackend } from "./otpService";

const PAY_ENDPOINT = "http://coursearena.great-site.net/pay.php";

export type MoMoProvider = "mtn" | "vod" | "tgo";

export interface ChargeResult {
  success: boolean;
  status: "success" | "send_otp" | "send_pin" | "open_url" | "pay_offline" | "pending" | "failed";
  reference: string;
  message?: string;
  amount?: number;
  new_balance?: number;
  error?: string;
}

export interface VerifyResult {
  success: boolean;
  status: "success" | "pending" | "failed";
  reference: string;
  amount?: number;
  new_balance?: number;
  message?: string;
  error?: string;
}

/**
 * Format a phone number to standard Ghana 10-digit format (e.g. 0551234567)
 */
export function formatGhanaPhone(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.startsWith("233") && cleaned.length === 12) {
    cleaned = "0" + cleaned.substring(3);
  } else if (cleaned.length === 9 && (cleaned.startsWith("2") || cleaned.startsWith("5"))) {
    cleaned = "0" + cleaned;
  }
  return cleaned;
}

/**
 * Automatically detect Mobile Money provider based on Ghana phone number prefix
 */
export function detectMoMoProvider(phone: string): MoMoProvider {
  const formatted = formatGhanaPhone(phone);
  if (formatted.length < 3) return "mtn";

  const prefix = formatted.substring(0, 3);
  // MTN: 024, 054, 055, 059, 025
  if (["024", "054", "055", "059", "025"].includes(prefix)) {
    return "mtn";
  }
  // Telecel (formerly Vodafone): 020, 050
  if (["020", "050"].includes(prefix)) {
    return "vod";
  }
  // AT (formerly AirtelTigo): 027, 057, 026
  if (["027", "057", "026"].includes(prefix)) {
    return "tgo";
  }

  return "mtn";
}

/**
 * Initiate Mobile Money direct charge via Paystack
 */
export async function chargeMobileMoney(params: {
  amount: number;
  phone: string;
  provider: MoMoProvider;
  email: string;
  uid: string;
}): Promise<ChargeResult> {
  const cleanedPhone = formatGhanaPhone(params.phone);
  return await callInfinityFreeBackend(PAY_ENDPOINT, {
    action: "charge",
    amount: params.amount,
    phone: cleanedPhone,
    provider: params.provider,
    email: params.email,
    uid: params.uid,
  });
}

/**
 * Submit authorization OTP code for Mobile Money charge
 */
export async function submitPaymentOtp(params: {
  reference: string;
  otp: string;
  uid: string;
  amount?: number;
}): Promise<ChargeResult> {
  return await callInfinityFreeBackend(PAY_ENDPOINT, {
    action: "submit_otp",
    reference: params.reference.trim(),
    otp: params.otp.trim(),
    uid: params.uid,
    amount: params.amount,
  });
}

/**
 * Check/verify status of a payment reference (used for USSD polling)
 */
export async function verifyPayment(params: {
  reference: string;
  uid: string;
}): Promise<VerifyResult> {
  return await callInfinityFreeBackend(PAY_ENDPOINT, {
    action: "verify",
    reference: params.reference.trim(),
    uid: params.uid,
  });
}

/**
 * Initiate in-app card charge via Paystack
 */
export async function chargeCard(params: {
  amount: number;
  cardNumber: string;
  cvv: string;
  expiryMonth: string;
  expiryYear: string;
  pin?: string;
  email: string;
  uid: string;
}): Promise<ChargeResult & { auth_url?: string }> {
  return await callInfinityFreeBackend(PAY_ENDPOINT, {
    action: "charge_card",
    amount: params.amount,
    card_number: params.cardNumber.replace(/\s+/g, ""),
    cvv: params.cvv.trim(),
    expiry_month: params.expiryMonth.trim(),
    expiry_year: params.expiryYear.trim(),
    pin: params.pin?.trim() || "",
    email: params.email,
    uid: params.uid,
  });
}

/**
 * Submit card bank PIN
 */
export async function submitPaymentPin(params: {
  reference: string;
  pin: string;
  uid: string;
  amount?: number;
}): Promise<ChargeResult & { auth_url?: string }> {
  return await callInfinityFreeBackend(PAY_ENDPOINT, {
    action: "submit_pin",
    reference: params.reference.trim(),
    pin: params.pin.trim(),
    uid: params.uid,
    amount: params.amount,
  });
}
