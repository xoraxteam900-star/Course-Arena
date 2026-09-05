const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { FieldValue } = require("firebase-admin/firestore");
const fetch = require("node-fetch");
const crypto = require("crypto");
const { db } = require("./admin");

const PAYSTACK_SECRET_KEY = defineSecret("PAYSTACK_SECRET_KEY");
const PAYSTACK_BASE = "https://api.paystack.co";

// Kicks off a deposit: creates a pending payment_transactions record and
// asks Paystack for a checkout URL. Nothing touches the wallet balance yet.
exports.paystackInitialize = onCall({ secrets: [PAYSTACK_SECRET_KEY] }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const amount = Number(request.data?.amount);
  if (!amount || amount <= 0) throw new HttpsError("invalid-argument", "Enter a valid amount.");

  const userDoc = await db.collection("users").doc(uid).get();
  const email = userDoc.data()?.email;
  if (!email) throw new HttpsError("failed-precondition", "No email on file.");

  const reference = `ca_${uid.slice(0, 8)}_${Date.now()}`;

  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY.value()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: Math.round(amount * 100), // Paystack expects kobo/pesewas
      reference,
      currency: "GHS",
    }),
  });
  const json = await res.json();
  if (!json.status) throw new HttpsError("internal", json.message || "Paystack initialization failed.");

  await db.collection("payment_transactions").doc(reference).set({
    userId: uid,
    reference,
    amount,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
    verifiedAt: null,
  });

  return { authorizationUrl: json.data.authorization_url, reference };
});

// Client-triggered verification, run right after the checkout browser
// session closes. The webhook below is the authoritative path in case
// the app is backgrounded/killed before this fires.
exports.paystackVerify = onCall({ secrets: [PAYSTACK_SECRET_KEY] }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const { reference } = request.data;
  if (!reference) throw new HttpsError("invalid-argument", "reference is required.");

  const result = await verifyAndCredit(reference, PAYSTACK_SECRET_KEY.value());
  if (result.status !== "success") return { status: result.status };

  const userDoc = await db.collection("users").doc(uid).get();
  return { status: "success", newBalance: userDoc.data()?.balance };
});

// Paystack server-to-server webhook. Configure this URL in the Paystack
// dashboard: https://us-central1-<project>.cloudfunctions.net/paystackWebhook
exports.paystackWebhook = onRequest({ secrets: [PAYSTACK_SECRET_KEY] }, async (req, res) => {
  const signature = req.headers["x-paystack-signature"];
  const hash = crypto
    .createHmac("sha512", PAYSTACK_SECRET_KEY.value())
    .update(JSON.stringify(req.body))
    .digest("hex");
  if (hash !== signature) {
    res.status(401).send("Invalid signature");
    return;
  }

  const event = req.body;
  if (event.event === "charge.success") {
    await verifyAndCredit(event.data.reference, PAYSTACK_SECRET_KEY.value());
  }
  res.status(200).send("ok");
});

// Shared logic: re-verifies the transaction directly with Paystack
// (never trust the client's or the webhook's claimed status alone),
// then credits the wallet exactly once via a Firestore transaction
// keyed on payment_transactions/{reference}.
async function verifyAndCredit(reference, secretKey) {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const json = await res.json();
  const paystackStatus = json?.data?.status === "success" ? "success" : "failed";

  const ref = db.collection("payment_transactions").doc(reference);

  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) return { status: "failed" };
    const payment = doc.data();
    if (payment.status === "success") return { status: "success" }; // already credited - idempotent
    if (paystackStatus !== "success") {
      tx.update(ref, { status: "failed" });
      return { status: "failed" };
    }

    const userRef = db.collection("users").doc(payment.userId);
    tx.update(userRef, { balance: FieldValue.increment(payment.amount) });
    tx.update(ref, { status: "success", verifiedAt: FieldValue.serverTimestamp() });
    tx.set(db.collection("transactions").doc(), {
      userId: payment.userId,
      type: "deposit",
      amount: payment.amount,
      description: `Wallet top-up (${reference})`,
      status: "completed",
      createdAt: FieldValue.serverTimestamp(),
    });
    return { status: "success" };
  });
}
