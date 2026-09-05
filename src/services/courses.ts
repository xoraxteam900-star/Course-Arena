import {
  collection,
  query,
  where,
  orderBy,
  limit as fbLimit,
  getDocs,
  doc,
  getDoc,
  increment,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { Category, Course } from "@/types";

export async function listCategories(): Promise<Category[]> {
  const snap = await getDocs(collection(db, "categories"));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function listPublishedCourses(opts?: {
  categoryId?: string;
  max?: number;
}): Promise<Course[]> {
  const clauses = [
    where("status", "==", "published"),
    where("reviewStatus", "==", "approved"),
  ];
  if (opts?.categoryId) clauses.push(where("categoryId", "==", opts.categoryId));
  const q = query(
    collection(db, "courses"),
    ...clauses,
    orderBy("createdAt", "desc"),
    fbLimit(opts?.max ?? 50)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

// Powers the Netflix-style home screen: one row per category, each with
// a handful of its most recent approved courses.
export async function coursesGroupedByCategory(perCategory = 6): Promise<
  { category: Category; courses: Course[] }[]
> {
  const categories = await listCategories();
  const groups = await Promise.all(
    categories.map(async (category) => {
      const courses = await listPublishedCourses({ categoryId: category.id, max: perCategory });
      return { category, courses };
    })
  );
  return groups.filter((g) => g.courses.length > 0);
}

export async function getCourse(courseId: string): Promise<Course | null> {
  const snap = await getDoc(doc(db, "courses", courseId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as any) };
}

export async function recordCourseView(courseId: string, userId: string) {
  // Idempotent-ish view: uses a deterministic doc id so a user only
  // increments the counter once per course, mirroring the unique key
  // in course_views.
  const viewRef = doc(db, "course_views", `${courseId}_${userId}`);
  const existing = await getDoc(viewRef);
  if (existing.exists()) return;
  const { setDoc, serverTimestamp } = await import("firebase/firestore");
  await setDoc(viewRef, { courseId, userId, viewedAt: serverTimestamp() });
  await updateDoc(doc(db, "courses", courseId), { viewCount: increment(1) });
}

export async function myPurchases(userId: string) {
  const snap = await getDocs(
    query(collection(db, "purchases"), where("userId", "==", userId))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function mySavedCourses(userId: string) {
  const snap = await getDocs(
    query(collection(db, "saved_courses"), where("userId", "==", userId))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function toggleSaveCourse(userId: string, courseId: string): Promise<boolean> {
  const { setDoc, deleteDoc, serverTimestamp } = await import("firebase/firestore");
  const docRef = doc(db, "saved_courses", `${userId}_${courseId}`);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    await deleteDoc(docRef);
    return false;
  } else {
    await setDoc(docRef, { userId, courseId, savedAt: serverTimestamp() });
    return true;
  }
}

export async function coursesByCreator(userId: string) {
  const snap = await getDocs(
    query(collection(db, "courses"), where("creatorUserId", "==", userId), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}
