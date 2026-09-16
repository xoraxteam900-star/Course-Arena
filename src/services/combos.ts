import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  runTransaction,
  serverTimestamp,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { Course } from "@/types";

export interface ComboGiveaway {
  id: string;
  title: string;
  courseIds: string[];
  price: number;
  isActive: boolean;
  createdAt: any;
}

/**
 * Admin creates a new giveaway combo
 */
export async function createComboGiveaway(
  title: string,
  courseIds: string[],
  price: number
): Promise<string> {
  const ref = await addDoc(collection(db, "combos"), {
    title,
    courseIds,
    price,
    isActive: true,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Admin marks a combo as inactive
 */
export async function deactivateCombo(comboId: string): Promise<void> {
  await updateDoc(doc(db, "combos", comboId), { isActive: false });
}

/**
 * Get the latest active combo (usually just 1)
 */
export async function getActiveCombo(): Promise<ComboGiveaway | null> {
  const q = query(
    collection(db, "combos"),
    where("isActive", "==", true),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const data = snap.docs[0].data();
  return { id: snap.docs[0].id, ...data } as ComboGiveaway;
}

/**
 * Buy a combo: Deduct price, add all course IDs to purchased
 */
export async function buyComboGiveaway(userId: string, combo: ComboGiveaway): Promise<void> {
  if (combo.courseIds.length === 0) throw new Error("Combo has no courses");

  await runTransaction(db, async (t) => {
    const userRef = doc(db, "users", userId);
    const userDoc = await t.get(userRef);

    if (!userDoc.exists()) {
      throw new Error("User does not exist");
    }

    const userData = userDoc.data();
    const currentBalance = userData.balance || 0;
    
    // Find which courses they don't already own
    const missingCourseIds = [];
    for (const cid of combo.courseIds) {
      const pDoc = await t.get(doc(db, "purchases", `${userId}_${cid}`));
      if (!pDoc.exists()) {
        missingCourseIds.push(cid);
      }
    }

    if (missingCourseIds.length === 0) {
      throw new Error("You already own all courses in this combo!");
    }

    if (currentBalance < combo.price) {
      throw new Error("Insufficient wallet balance");
    }

    // Deduct total combo price
    t.update(userRef, {
      balance: currentBalance - combo.price,
    });
    
    // Create transaction log
    const transactionRef = doc(collection(db, "transactions"));
    t.set(transactionRef, {
      userId,
      type: "purchase",
      amount: -combo.price,
      description: `Purchased Combo: ${combo.title}`,
      status: "completed",
      createdAt: serverTimestamp(),
    });

    // Grant access to all missing courses
    for (const cid of missingCourseIds) {
      const pRef = doc(db, "purchases", `${userId}_${cid}`);
      t.set(pRef, {
        userId,
        courseId: cid,
        pricePaid: 0, // Paid as part of combo
        purchasedAt: serverTimestamp(),
      });
    }
  });
}
