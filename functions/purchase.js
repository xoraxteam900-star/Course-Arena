const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("./admin");

exports.purchaseCourse = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const { courseId } = request.data;
  if (!courseId) throw new HttpsError("invalid-argument", "courseId is required.");

  const purchaseRef = db.collection("purchases").doc(`${uid}_${courseId}`);
  const courseRef = db.collection("courses").doc(courseId);
  const accessRef = db.collection("course_access").doc(courseId);
  const userRef = db.collection("users").doc(uid);

  const accessLink = await db.runTransaction(async (tx) => {
    const [purchaseDoc, courseDoc, accessDoc, userDoc] = await Promise.all([
      tx.get(purchaseRef),
      tx.get(courseRef),
      tx.get(accessRef),
      tx.get(userRef),
    ]);

    if (purchaseDoc.exists) {
      // Already owned - idempotent, just hand back the link again.
      return accessDoc.data()?.accessLink ?? null;
    }
    if (!courseDoc.exists) throw new HttpsError("not-found", "Course not found.");
    const course = courseDoc.data();
    if (course.status !== "published" || course.reviewStatus !== "approved") {
      throw new HttpsError("failed-precondition", "This course isn't available for purchase.");
    }
    if (!userDoc.exists) throw new HttpsError("not-found", "User profile not found.");
    const user = userDoc.data();
    if (user.status === "suspended") throw new HttpsError("permission-denied", "Account suspended.");

    const price = course.price || 0;
    if ((user.balance || 0) < price) {
      throw new HttpsError("failed-precondition", "Insufficient wallet balance.");
    }

    tx.update(userRef, { balance: FieldValue.increment(-price) });
    tx.set(purchaseRef, {
      userId: uid,
      courseId,
      pricePaid: price,
      purchasedAt: FieldValue.serverTimestamp(),
    });
    tx.set(db.collection("transactions").doc(), {
      userId: uid,
      type: "purchase",
      amount: -price,
      description: `Purchased: ${course.title}`,
      status: "completed",
      createdAt: FieldValue.serverTimestamp(),
    });

    return accessDoc.data()?.accessLink ?? null;
  });

  return { accessLink };
});

// Lets a user who already owns a course fetch its access link again
// (e.g. after reopening the app) without re-exposing it to non-buyers.
exports.getMyAccessLink = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const { courseId } = request.data;
  if (!courseId) throw new HttpsError("invalid-argument", "courseId is required.");

  const purchaseDoc = await db.collection("purchases").doc(`${uid}_${courseId}`).get();
  if (!purchaseDoc.exists) throw new HttpsError("permission-denied", "You don't own this course.");

  const accessDoc = await db.collection("course_access").doc(courseId).get();
  return { accessLink: accessDoc.data()?.accessLink ?? null };
});
