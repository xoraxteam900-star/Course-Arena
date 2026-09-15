import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  addDoc,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { AppNotification } from "@/types";

/**
 * Fetch all notifications visible to a specific user, excluding those marked as deleted/dismissed.
 */
export async function listNotificationsFor(userId: string): Promise<AppNotification[]> {
  try {
    const [mineSnap, broadcastSnap, readsSnap] = await Promise.all([
      getDocs(query(collection(db, "notifications"), where("targetUserId", "==", userId))),
      getDocs(query(collection(db, "notifications"), where("targetUserId", "==", null))),
      getDocs(query(collection(db, "notification_reads"), where("userId", "==", userId))),
    ]);

    const deletedIds = new Set<string>();
    const readIds = new Set<string>();

    readsSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.isDeleted) {
        deletedIds.add(data.notificationId);
      }
      if (data.readAt) {
        readIds.add(data.notificationId);
      }
    });

    const mine = mineSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
      read: readIds.has(d.id),
    })) as AppNotification[];

    const broadcast = broadcastSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
      read: readIds.has(d.id),
    })) as AppNotification[];

    return [...mine, ...broadcast]
      .filter((n) => !deletedIds.has(n.id))
      .sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() ?? (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.createdAt?.toMillis?.() ?? (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });
  } catch (err) {
    console.error("Error listing notifications:", err);
    return [];
  }
}

/**
 * Real-time subscription to notifications for a user, automatically excluding deleted items.
 */
export function subscribeNotifications(
  userId: string,
  onUpdate: (notifs: AppNotification[]) => void
): () => void {
  let mineDocs: AppNotification[] = [];
  let broadcastDocs: AppNotification[] = [];
  let readMap = new Map<string, { isDeleted: boolean; readAt: any }>();

  const emitMerged = () => {
    const all = [...mineDocs, ...broadcastDocs];
    const filtered = all
      .filter((n) => {
        const record = readMap.get(n.id);
        return !record?.isDeleted;
      })
      .map((n) => ({
        ...n,
        read: !!readMap.get(n.id)?.readAt,
      }))
      .sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() ?? (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.createdAt?.toMillis?.() ?? (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });

    onUpdate(filtered);
  };

  const unsubMine = onSnapshot(
    query(collection(db, "notifications"), where("targetUserId", "==", userId)),
    (snap) => {
      mineDocs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      emitMerged();
    },
    (err) => console.warn("Notifications listener error (mine):", err)
  );

  const unsubBroadcast = onSnapshot(
    query(collection(db, "notifications"), where("targetUserId", "==", null)),
    (snap) => {
      broadcastDocs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      emitMerged();
    },
    (err) => console.warn("Notifications listener error (broadcast):", err)
  );

  const unsubReads = onSnapshot(
    query(collection(db, "notification_reads"), where("userId", "==", userId)),
    (snap) => {
      readMap = new Map();
      snap.docs.forEach((d) => {
        const data = d.data();
        readMap.set(data.notificationId, {
          isDeleted: !!data.isDeleted,
          readAt: data.readAt,
        });
      });
      emitMerged();
    },
    (err) => console.warn("Notifications listener error (reads):", err)
  );

  return () => {
    unsubMine();
    unsubBroadcast();
    unsubReads();
  };
}

/**
 * Mark a notification as read
 */
export async function markRead(notificationId: string, userId: string) {
  try {
    await setDoc(
      doc(db, "notification_reads", `${notificationId}_${userId}`),
      {
        notificationId,
        userId,
        readAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    console.error("Failed to mark notification as read", e);
  }
}

/**
 * Delete a notification:
 * - If personal (targetUserId == userId): delete document from firestore.
 * - If broadcast (targetUserId == null): mark isDeleted = true in notification_reads for this user.
 */
export async function deleteNotification(
  notification: AppNotification,
  userId: string
): Promise<void> {
  try {
    if (notification.targetUserId === userId) {
      await deleteDoc(doc(db, "notifications", notification.id));
      try {
        await deleteDoc(doc(db, "notification_reads", `${notification.id}_${userId}`));
      } catch (_) {}
    } else {
      await setDoc(
        doc(db, "notification_reads", `${notification.id}_${userId}`),
        {
          notificationId: notification.id,
          userId,
          isDeleted: true,
          readAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (err) {
    console.error("Failed to delete notification:", err);
    throw err;
  }
}

/**
 * Core requested behavior:
 * When user reads a notification, immediately delete/remove it.
 */
export async function readAndDeleteNotification(
  notification: AppNotification,
  userId: string
): Promise<void> {
  return deleteNotification(notification, userId);
}

/**
 * Clear all notifications for a user at once
 */
export async function clearAllNotifications(
  notifications: AppNotification[],
  userId: string
): Promise<void> {
  const promises = notifications.map((n) => deleteNotification(n, userId));
  await Promise.all(promises);
}

/**
 * Helper to dispatch a notification (used by admin or system actions)
 */
export async function sendNotification(data: {
  title: string;
  message: string;
  targetUserId?: string | null;
  type?: "system" | "report" | "course" | "wallet" | "chat" | "promo" | "security" | string;
  courseId?: string | null;
  actionUrl?: string | null;
  promoCode?: string | null;
}): Promise<string> {
  const ref = await addDoc(collection(db, "notifications"), {
    title: data.title.trim(),
    message: data.message.trim(),
    targetUserId: data.targetUserId ?? null,
    type: data.type || "system",
    courseId: data.courseId ?? null,
    actionUrl: data.actionUrl ?? null,
    promoCode: data.promoCode ?? null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}
