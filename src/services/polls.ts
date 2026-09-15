import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  runTransaction,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/firebase/config";

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  createdBy: string;
  createdAt: any;
  expiresAt: any;
  status: "active" | "ended";
}

/**
 * Create a new poll with an end time
 */
export async function createPoll(params: {
  question: string;
  options: string[];
  durationHours: number;
  createdBy: string;
}): Promise<string> {
  const { question, options, durationHours, createdBy } = params;

  if (!question.trim()) throw new Error("Poll question is required.");
  const validOptions = options.map((o) => o.trim()).filter(Boolean);
  if (validOptions.length < 2) throw new Error("At least 2 options are required.");

  const now = Date.now();
  const expireDate = new Date(now + durationHours * 3600 * 1000);

  const pollRef = doc(collection(db, "polls"));
  const pollOptions: PollOption[] = validOptions.map((text, idx) => ({
    id: `opt_${idx + 1}_${Math.random().toString(36).substring(2, 7)}`,
    text,
    votes: 0,
  }));

  await setDoc(pollRef, {
    question: question.trim(),
    options: pollOptions,
    totalVotes: 0,
    createdBy,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expireDate),
    status: "active",
  });

  return pollRef.id;
}

/**
 * Listen to all polls in real time (sorted by creation date)
 */
export function listenToPolls(callback: (polls: Poll[]) => void) {
  const q = query(collection(db, "polls"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snapshot) => {
      const polls = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as Poll[];
      callback(polls);
    },
    (err) => {
      console.warn("listenToPolls error:", err);
    }
  );
}

/**
 * Listen to active polls for users on the home screen
 */
export function listenToActivePolls(callback: (polls: Poll[]) => void) {
  return listenToPolls((allPolls) => {
    const now = Date.now();
    const active = allPolls.filter((p) => {
      if (p.status !== "active") return false;
      if (p.expiresAt) {
        const exp = p.expiresAt.toMillis ? p.expiresAt.toMillis() : new Date(p.expiresAt).getTime();
        return exp > now;
      }
      return true;
    });
    callback(active);
  });
}

/**
 * Check which option a user voted for (or null if not voted)
 */
export async function getUserVoteForPoll(pollId: string, userId: string): Promise<string | null> {
  try {
    const voteRef = doc(db, "poll_votes", `${pollId}_${userId}`);
    const snap = await getDoc(voteRef);
    if (snap.exists()) {
      return snap.data()?.optionId ?? null;
    }
    return null;
  } catch (err) {
    console.warn("getUserVoteForPoll error:", err);
    return null;
  }
}

/**
 * Cast a vote on a poll
 */
export async function voteOnPoll(pollId: string, optionId: string, userId: string): Promise<void> {
  const voteRef = doc(db, "poll_votes", `${pollId}_${userId}`);
  const pollRef = doc(db, "polls", pollId);

  await runTransaction(db, async (tx) => {
    const voteDoc = await tx.get(voteRef);
    if (voteDoc.exists()) {
      throw new Error("You have already voted on this poll.");
    }

    const pollDoc = await tx.get(pollRef);
    if (!pollDoc.exists()) {
      throw new Error("This poll no longer exists.");
    }

    const pollData = pollDoc.data() as Poll;
    if (pollData.status !== "active") {
      throw new Error("This poll has ended.");
    }

    if (pollData.expiresAt) {
      const exp = pollData.expiresAt.toMillis
        ? pollData.expiresAt.toMillis()
        : new Date(pollData.expiresAt).getTime();
      if (exp <= Date.now()) {
        tx.update(pollRef, { status: "ended" });
        throw new Error("This poll has expired.");
      }
    }

    const updatedOptions = (pollData.options || []).map((opt) => {
      if (opt.id === optionId) {
        return { ...opt, votes: (opt.votes || 0) + 1 };
      }
      return opt;
    });

    const newTotalVotes = (pollData.totalVotes || 0) + 1;

    tx.update(pollRef, {
      options: updatedOptions,
      totalVotes: newTotalVotes,
    });

    tx.set(voteRef, {
      pollId,
      optionId,
      userId,
      votedAt: serverTimestamp(),
    });
  });
}

/**
 * Close poll early (Admin only)
 */
export async function closePoll(pollId: string): Promise<void> {
  await updateDoc(doc(db, "polls", pollId), {
    status: "ended",
  });
}

/**
 * Delete poll (Admin only)
 */
export async function deletePoll(pollId: string): Promise<void> {
  await deleteDoc(doc(db, "polls", pollId));
}
