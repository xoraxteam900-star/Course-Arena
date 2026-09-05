const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("./admin");

const SIGNUP_BONUS = 5; // GH₵ — matches the original app's signup_bonus transaction type

// Mirrors the PHP app crediting a one-time signup bonus. Runs server-side
// so a client can never fake `signupBonusGiven` to farm free balance.
exports.onUserCreate = onDocumentCreated("users/{userId}", async (event) => {
  const snap = event.data;
  if (!snap) return;
  const userId = event.params.userId;
  const data = snap.data();
  if (data.signupBonusGiven) return;

  await db.runTransaction(async (tx) => {
    const userRef = db.collection("users").doc(userId);
    const userDoc = await tx.get(userRef);
    if (!userDoc.exists || userDoc.data().signupBonusGiven) return;

    tx.update(userRef, {
      balance: FieldValue.increment(SIGNUP_BONUS),
      signupBonusGiven: true,
    });
    tx.set(db.collection("transactions").doc(), {
      userId,
      type: "signup_bonus",
      amount: SIGNUP_BONUS,
      description: "Welcome bonus",
      status: "completed",
      createdAt: FieldValue.serverTimestamp(),
    });
  });
});

// Recomputes course.avgRating / ratingCount whenever a review is
// created, edited, or deleted — keeps aggregate fields consistent
// without trusting client-side increments (ratings can change on edit,
// not just +1/-1).
exports.onReviewWrite = onDocumentWritten("course_reviews/{reviewId}", async (event) => {
  const courseId = (event.data?.after?.data() || event.data?.before?.data())?.courseId;
  if (!courseId) return;

  const reviewsSnap = await db.collection("course_reviews").where("courseId", "==", courseId).get();
  const ratings = reviewsSnap.docs.map((d) => d.data().rating).filter((r) => typeof r === "number");
  const ratingCount = ratings.length;
  const avgRating = ratingCount ? ratings.reduce((a, b) => a + b, 0) / ratingCount : 0;

  await db.collection("courses").doc(courseId).update({ avgRating, ratingCount });
});
