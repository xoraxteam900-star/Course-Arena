import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase/config";

// Notifications with targetUserId == null are broadcasts (visible to everyone).
export async function listNotificationsFor(userId: string) {
  const [mineSnap, broadcastSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, "notifications"),
        where("targetUserId", "==", userId),
        orderBy("createdAt", "desc")
      )
    ),
    getDocs(
      query(
        collection(db, "notifications"),
        where("targetUserId", "==", null),
        orderBy("createdAt", "desc")
      )
    ),
  ]);
  const mine = mineSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  const broadcast = broadcastSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  return [...mine, ...broadcast].sort(
    (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
  );
}

export async function markRead(notificationId: string, userId: string) {
  await setDoc(doc(db, "notification_reads", `${notificationId}_${userId}`), {
    notificationId,
    userId,
    readAt: serverTimestamp(),
  });
}
