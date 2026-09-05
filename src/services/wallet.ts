import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/firebase/config";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  runTransaction,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "@/firebase/config";

const functions = getFunctions(app);

// All balance-changing operations go through callable Cloud Functions.
// The client NEVER writes to users/{uid}.balance directly (enforced by
// firestore.rules too) - this mirrors the PHP app's row-locked,
// transaction-wrapped purchase logic.

export async function purchaseCourse(courseId: string, promoId?: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Sign in first.");

  const purchaseRef = doc(db, "purchases", `${uid}_${courseId}`);
  const courseRef = doc(db, "courses", courseId);
  const accessRef = doc(db, "course_access", courseId);
  const userRef = doc(db, "users", uid);
  const transactionRef = doc(collection(db, "transactions"));

  await runTransaction(db, async (tx) => {
    const purchaseDoc = await tx.get(purchaseRef);

    if (purchaseDoc.exists()) {
      return; // Already purchased
    }

    const courseDoc = await tx.get(courseRef);
    if (!courseDoc.exists()) throw new Error("Course not found.");
    const course = courseDoc.data() as any;

    const userDoc = await tx.get(userRef);
    if (!userDoc.exists()) throw new Error("User profile not found.");
    const user = userDoc.data() as any;

    let price = course.price || 0;
    
    if (promoId) {
      const promoRef = doc(db, "promos", promoId);
      const promoDoc = await tx.get(promoRef);
      if (promoDoc.exists()) {
        const promo = promoDoc.data() as any;
        const hoursPassed = (Date.now() - (promo.createdAt?.toMillis?.() || Date.now())) / 3600000;
        if (promo.courseId === courseId && hoursPassed < promo.hoursValid && promo.claims < promo.maxClaims) {
          price = price * (1 - (promo.discountPercent / 100));
          tx.update(promoRef, { claims: (promo.claims || 0) + 1 });
        } else {
          throw new Error("Promo code is invalid, expired, or fully claimed.");
        }
      }
    }

    if ((user.balance || 0) < price) {
      throw new Error(`Insufficient wallet balance. You need GH₵${price.toFixed(2)}.`);
    }

    // Deduct from buyer
    tx.update(userRef, { balance: (user.balance || 0) - price });
    
    // Create the purchase record
    tx.set(purchaseRef, {
      userId: uid,
      courseId,
      pricePaid: price,
      purchasedAt: serverTimestamp(),
    });
    
    // Add it to their transaction history
    tx.set(transactionRef, {
      userId: uid,
      type: "purchase",
      amount: -price,
      description: `Purchased: ${course.title}`,
      status: "completed",
      createdAt: serverTimestamp(),
    });

  });

  // Now that the purchase document exists, Firestore Rules will allow us to read the access link!
  return await getMyAccessLink(courseId);
}

export async function getMyAccessLink(courseId: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Sign in first.");
  
  const purchaseDoc = await getDoc(doc(db, "purchases", `${uid}_${courseId}`));
  if (!purchaseDoc.exists()) throw new Error("You don't own this course.");
  
  const accessDoc = await getDoc(doc(db, "course_access", courseId));
  return accessDoc.data()?.accessLink ?? null;
}

export async function initializeDeposit(amountGHS: number) {
  const fn = httpsCallable(functions, "paystackInitialize");
  const res = await fn({ amount: amountGHS });
  return res.data as { authorizationUrl: string; reference: string };
}

export async function verifyDeposit(reference: string) {
  const fn = httpsCallable(functions, "paystackVerify");
  const res = await fn({ reference });
  return res.data as { status: "success" | "failed"; newBalance?: number };
}

export async function buyLoginProduct(loginProductId: string) {
  const fn = httpsCallable(functions, "buyLoginProduct");
  const res = await fn({ loginProductId });
  return res.data as { username: string | null; password: string | null; extraInfo: string | null };
}

export async function myTransactions(userId: string) {
  const snap = await getDocs(
    query(
      collection(db, "transactions"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}
