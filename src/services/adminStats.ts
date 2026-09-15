import { collection, query, where, getCountFromServer, getAggregateFromServer, count, sum } from "firebase/firestore";
import { db } from "@/firebase/config";

export interface AdminStats {
  totalUsers: number;
  totalCourses: number;
  publishedCourses: number;
  pendingReview: number;
  totalPurchases: number;
  totalRevenue: number;
}

/**
 * Uses Firestore's server-side count/sum aggregations instead of
 * downloading every document just to count it — each of these is a
 * single small network round trip regardless of collection size, which
 * is what keeps the admin dashboard opening fast even as the app grows.
 */
export async function getAdminStats(): Promise<AdminStats> {
  const usersCol = collection(db, "users");
  const coursesCol = collection(db, "courses");
  const purchasesCol = collection(db, "purchases");

  const [
    usersCount,
    coursesCount,
    publishedCount,
    pendingCount,
    purchasesAgg,
  ] = await Promise.all([
    getCountFromServer(usersCol),
    getCountFromServer(coursesCol),
    getCountFromServer(query(coursesCol, where("status", "==", "published"))),
    getCountFromServer(query(coursesCol, where("reviewStatus", "==", "pending_review"))),
    getAggregateFromServer(purchasesCol, { count: count(), revenue: sum("pricePaid") }).catch(() => null),
  ]);

  let totalPurchases = 0;
  let totalRevenue = 0;
  if (purchasesAgg) {
    const data = purchasesAgg.data() as any;
    totalPurchases = data.count ?? 0;
    totalRevenue = data.revenue ?? 0;
  } else {
    // Aggregation failed (e.g. an old Firestore SDK on the backend) —
    // fall back to a plain count so the dashboard still loads.
    const fallbackCount = await getCountFromServer(purchasesCol);
    totalPurchases = fallbackCount.data().count;
  }

  return {
    totalUsers: usersCount.data().count,
    totalCourses: coursesCount.data().count,
    publishedCourses: publishedCount.data().count,
    pendingReview: pendingCount.data().count,
    totalPurchases,
    totalRevenue,
  };
}
