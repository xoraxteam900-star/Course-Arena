const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("./admin");

const APPROVAL_REWARD = 6; // GH₵ — matches the original app's course_approval_reward

async function assertAdmin(uid) {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const doc = await db.collection("users").doc(uid).get();
  if (doc.data()?.role !== "admin") throw new HttpsError("permission-denied", "Admins only.");
}

exports.approveCourse = onCall(async (request) => {
  await assertAdmin(request.auth?.uid);
  const { courseId } = request.data;
  if (!courseId) throw new HttpsError("invalid-argument", "courseId is required.");

  await db.runTransaction(async (tx) => {
    const courseRef = db.collection("courses").doc(courseId);
    const courseDoc = await tx.get(courseRef);
    if (!courseDoc.exists) throw new HttpsError("not-found", "Course not found.");
    const course = courseDoc.data();

    tx.update(courseRef, {
      status: "published",
      reviewStatus: "approved",
      approvedAt: FieldValue.serverTimestamp(),
      approvalRewarded: true,
      rejectionReason: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (course.creatorUserId && !course.approvalRewarded) {
      tx.update(db.collection("users").doc(course.creatorUserId), {
        balance: FieldValue.increment(APPROVAL_REWARD),
      });
      tx.set(db.collection("transactions").doc(), {
        userId: course.creatorUserId,
        type: "course_approval_reward",
        amount: APPROVAL_REWARD,
        description: `"${course.title}" was approved`,
        status: "completed",
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  });

  return { ok: true };
});

exports.rejectCourse = onCall(async (request) => {
  await assertAdmin(request.auth?.uid);
  const { courseId, reason } = request.data;
  if (!courseId) throw new HttpsError("invalid-argument", "courseId is required.");

  await db.collection("courses").doc(courseId).update({
    status: "hidden",
    reviewStatus: "rejected",
    rejectionReason: reason || "Did not meet guidelines.",
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { ok: true };
});

// Promote a regular user to admin. Callable only by an existing admin -
// run this once manually via the Firebase console/emulator for the
// very first admin (see functions/README section on bootstrapping).
exports.setUserRole = onCall(async (request) => {
  await assertAdmin(request.auth?.uid);
  const { targetUid, role } = request.data;
  if (!targetUid || !["user", "instructor", "admin"].includes(role)) {
    throw new HttpsError("invalid-argument", "targetUid and a valid role are required.");
  }
  await db.collection("users").doc(targetUid).update({ role });
  return { ok: true };
});
