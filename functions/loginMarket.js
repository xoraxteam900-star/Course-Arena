const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("./admin");

// Mirrors purchase.js but for the Logins Market: one buyer per listing,
// status flips available -> sold atomically so two buyers can never
// win the same listing.
exports.buyLoginProduct = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const { loginProductId } = request.data;
  if (!loginProductId) throw new HttpsError("invalid-argument", "loginProductId is required.");

  const productRef = db.collection("login_products").doc(loginProductId);
  const secretRef = db.collection("login_products_secrets").doc(loginProductId);
  const userRef = db.collection("users").doc(uid);

  const result = await db.runTransaction(async (tx) => {
    const [productDoc, secretDoc, userDoc] = await Promise.all([
      tx.get(productRef),
      tx.get(secretRef),
      tx.get(userRef),
    ]);
    if (!productDoc.exists) throw new HttpsError("not-found", "Listing not found.");
    const product = productDoc.data();
    const secret = secretDoc.exists ? secretDoc.data() : {};
    if (product.status !== "available") throw new HttpsError("failed-precondition", "Already sold.");
    if (!userDoc.exists) throw new HttpsError("not-found", "User profile not found.");
    const user = userDoc.data();
    if ((user.balance || 0) < product.price) {
      throw new HttpsError("failed-precondition", "Insufficient wallet balance.");
    }

    tx.update(userRef, { balance: FieldValue.increment(-product.price) });
    tx.update(productRef, {
      status: "sold",
      buyerUserId: uid,
      soldAt: FieldValue.serverTimestamp(),
    });
    tx.set(db.collection("transactions").doc(), {
      userId: uid,
      type: "purchase",
      amount: -product.price,
      description: `Login purchase: ${product.title}`,
      status: "completed",
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      username: secret.loginUsername || null,
      password: secret.loginPassword || null,
      extraInfo: secret.extraInfo || null,
    };
  });

  return result;
});
