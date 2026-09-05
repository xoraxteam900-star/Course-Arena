import {
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  updateDoc,
  increment,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase/config";

export async function toggleLike(courseId: string, userId: string) {
  const likeRef = doc(db, "course_likes", `${courseId}_${userId}`);
  const existing = await getDoc(likeRef);
  const courseRef = doc(db, "courses", courseId);
  if (existing.exists()) {
    await deleteDoc(likeRef);
    await updateDoc(courseRef, { likeCount: increment(-1) });
    return false;
  } else {
    await setDoc(likeRef, { courseId, userId, createdAt: serverTimestamp() });
    await updateDoc(courseRef, { likeCount: increment(1) });
    return true;
  }
}

export async function toggleSave(courseId: string, userId: string) {
  const saveRef = doc(db, "saved_courses", `${courseId}_${userId}`);
  const existing = await getDoc(saveRef);
  const courseRef = doc(db, "courses", courseId);
  if (existing.exists()) {
    await deleteDoc(saveRef);
    await updateDoc(courseRef, { saveCount: increment(-1) });
    return false;
  } else {
    await setDoc(saveRef, { courseId, userId, createdAt: serverTimestamp() });
    await updateDoc(courseRef, { saveCount: increment(1) });
    return true;
  }
}

export async function addComment(courseId: string, userId: string, message: string) {
  await addDoc(collection(db, "course_comments"), {
    courseId,
    userId,
    message,
    likeCount: 0,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "courses", courseId), { commentCount: increment(1) });
}

export async function listComments(courseId: string) {
  const snap = await getDocs(
    query(
      collection(db, "course_comments"),
      where("courseId", "==", courseId),
      orderBy("createdAt", "desc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function editComment(commentId: string, message: string) {
  await updateDoc(doc(db, "course_comments", commentId), { message, updatedAt: serverTimestamp() });
}

export async function deleteComment(commentId: string, courseId: string) {
  await deleteDoc(doc(db, "course_comments", commentId));
  await updateDoc(doc(db, "courses", courseId), { commentCount: increment(-1) });
}

export async function submitReview(
  courseId: string,
  userId: string,
  rating: number,
  reviewText: string
) {
  // One review per user per course - deterministic doc id enforces this,
  // mirroring the unique key on (user_id, course_id).
  const ref = doc(db, "course_reviews", `${userId}_${courseId}`);
  const existing = await getDoc(ref);
  await setDoc(
    ref,
    {
      courseId,
      userId,
      rating,
      reviewText,
      createdAt: existing.exists() ? existing.data()?.createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  // Recomputing avgRating/ratingCount accurately under concurrent writes
  // needs a transaction; that's done server-side in the
  // `onReviewWrite` Cloud Function trigger (functions/triggers.js).
}

export async function fileReport(courseId: string, userId: string, reason: string) {
  await addDoc(collection(db, "course_reports"), {
    courseId,
    userId,
    reason,
    status: "open",
    lastMessageAt: serverTimestamp(),
    userSeenAt: null,
    createdAt: serverTimestamp(),
  });
}
