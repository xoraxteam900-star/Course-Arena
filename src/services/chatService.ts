import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  limit,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "@/firebase/config";

export interface FriendRequest {
  id: string;
  senderId: string;
  senderUsername: string;
  senderFullName: string;
  receiverId: string;
  receiverUsername: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: any;
}

export interface FriendItem {
  id: string;
  userId: string;
  friendId: string;
  friendUsername: string;
  friendFullName: string;
  createdAt: any;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  mediaUrl?: string | null;
  mediaType?: "video" | "image" | null;
  createdAt: any;
  read?: boolean;
}

export interface ChatThread {
  id: string;
  participantIds: string[];
  participants: Record<string, { username: string; fullName: string; avatar?: string }>;
  lastMessage: string;
  lastMessageAt: any;
  lastSenderId?: string;
}

/**
 * Send a friend request
 */
export async function sendFriendRequest(targetUser: { uid: string; username: string; fullName?: string }) {
  const senderUid = auth.currentUser?.uid;
  if (!senderUid) throw new Error("Please sign in first.");
  if (senderUid === targetUser.uid) throw new Error("You cannot add yourself as a friend.");

  // Check if already friends
  const friendDoc = await getDoc(doc(db, "friends", `${senderUid}_${targetUser.uid}`));
  if (friendDoc.exists()) {
    throw new Error("You are already friends with this user.");
  }

  // Check if pending request exists
  const q = query(
    collection(db, "friend_requests"),
    where("senderId", "==", senderUid),
    where("receiverId", "==", targetUser.uid),
    where("status", "==", "pending")
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    throw new Error("Friend request already sent.");
  }

  // Get sender profile details
  const senderSnap = await getDoc(doc(db, "users", senderUid));
  const senderData = senderSnap.data();

  await addDoc(collection(db, "friend_requests"), {
    senderId: senderUid,
    senderUsername: senderData?.username || "friend",
    senderFullName: senderData?.fullName || senderData?.displayName || "Learner",
    receiverId: targetUser.uid,
    receiverUsername: targetUser.username,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

/**
 * Accept a friend request
 */
export async function acceptFriendRequest(req: FriendRequest) {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) throw new Error("Please sign in first.");

  // Mark request as accepted
  await updateDoc(doc(db, "friend_requests", req.id), {
    status: "accepted",
    updatedAt: serverTimestamp(),
  });

  // Get current user profile
  const mySnap = await getDoc(doc(db, "users", currentUid));
  const myData = mySnap.data();

  // Create two-way friend entries
  await setDoc(doc(db, "friends", `${currentUid}_${req.senderId}`), {
    userId: currentUid,
    friendId: req.senderId,
    friendUsername: req.senderUsername,
    friendFullName: req.senderFullName,
    createdAt: serverTimestamp(),
  });

  await setDoc(doc(db, "friends", `${req.senderId}_${currentUid}`), {
    userId: req.senderId,
    friendId: currentUid,
    friendUsername: myData?.username || "friend",
    friendFullName: myData?.fullName || myData?.displayName || "Learner",
    createdAt: serverTimestamp(),
  });
}

/**
 * Reject a friend request
 */
export async function rejectFriendRequest(requestId: string) {
  await updateDoc(doc(db, "friend_requests", requestId), {
    status: "rejected",
    updatedAt: serverTimestamp(),
  });
}

/**
 * Listen to incoming friend requests for current user
 */
export function listenToFriendRequests(userId: string, onUpdate: (requests: FriendRequest[]) => void) {
  const q = query(
    collection(db, "friend_requests"),
    where("receiverId", "==", userId),
    where("status", "==", "pending")
  );
  return onSnapshot(q, (snap) => {
    const list: FriendRequest[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
    onUpdate(list);
  });
}

/**
 * Listen to friend list for current user
 */
export function listenToFriends(userId: string, onUpdate: (friends: FriendItem[]) => void) {
  const q = query(collection(db, "friends"), where("userId", "==", userId));
  return onSnapshot(q, (snap) => {
    const list: FriendItem[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
    onUpdate(list);
  });
}

/**
 * Search users by query string
 */
export async function searchUsers(searchTerm: string) {
  const clean = searchTerm.trim().toLowerCase().replace(/^@/, "");
  if (!clean) return [];

  const snap = await getDocs(
    query(collection(db, "users"), limit(50))
  );

  const results: any[] = [];
  snap.forEach((d) => {
    const data = d.data();
    const uName = (data.username || "").toLowerCase();
    const fName = (data.fullName || data.displayName || "").toLowerCase();
    if (uName.includes(clean) || fName.includes(clean)) {
      results.push({ uid: d.id, id: d.id, ...data });
    }
  });

  return results;
}

/**
 * Get or create a 1-on-1 chat room
 */
export async function getOrCreateChat(friend: {
  uid: string;
  username: string;
  fullName?: string;
  avatar?: string;
}): Promise<string> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) throw new Error("Please sign in first.");

  const chatId = [currentUid, friend.uid].sort().join("_");
  const chatRef = doc(db, "chats", chatId);
  const snap = await getDoc(chatRef);

  if (!snap.exists()) {
    const mySnap = await getDoc(doc(db, "users", currentUid));
    const myData = mySnap.data();

    await setDoc(chatRef, {
      participantIds: [currentUid, friend.uid],
      participants: {
        [currentUid]: {
          username: myData?.username || "me",
          fullName: myData?.fullName || myData?.displayName || "Me",
          avatar: myData?.avatar || null,
        },
        [friend.uid]: {
          username: friend.username,
          fullName: friend.fullName || friend.username,
          avatar: friend.avatar || null,
        },
      },
      lastMessage: "Chat created",
      lastMessageAt: serverTimestamp(),
      lastSenderId: currentUid,
      createdAt: serverTimestamp(),
    });
  }

  return chatId;
}

/**
 * Send a message (text or video/media)
 */
export async function sendChatMessage(params: {
  chatId: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: "video" | "image";
}) {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) throw new Error("Please sign in first.");

  const cleanText = params.text?.trim() || "";
  if (!cleanText && !params.mediaUrl) {
    throw new Error("Cannot send empty message.");
  }

  const messagesRef = collection(db, "chats", params.chatId, "messages");
  await addDoc(messagesRef, {
    senderId: currentUid,
    text: cleanText,
    mediaUrl: params.mediaUrl || null,
    mediaType: params.mediaType || null,
    createdAt: serverTimestamp(),
    read: false,
  });

  let summary = cleanText;
  if (!summary) {
    summary = params.mediaType === "video" ? "🎥 Video" : "📷 Image";
  }

  await updateDoc(doc(db, "chats", params.chatId), {
    lastMessage: summary,
    lastMessageAt: serverTimestamp(),
    lastSenderId: currentUid,
  });
}

/**
 * Listen to messages inside a chat room (real-time)
 */
export function listenToChatMessages(chatId: string, onUpdate: (msgs: ChatMessage[]) => void) {
  const q = query(
    collection(db, "chats", chatId, "messages"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    const list: ChatMessage[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
    onUpdate(list);
  });
}

/**
 * Listen to all chat threads for the current user
 */
export function listenToUserChats(userId: string, onUpdate: (threads: ChatThread[]) => void) {
  const q = query(
    collection(db, "chats"),
    where("participantIds", "array-contains", userId)
  );
  return onSnapshot(q, (snap) => {
    const list: ChatThread[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
    list.sort((a, b) => {
      const tA = a.lastMessageAt?.toMillis?.() || 0;
      const tB = b.lastMessageAt?.toMillis?.() || 0;
      return tB - tA;
    });
    onUpdate(list);
  });
}

/**
 * Upload chat media (video or image) to Firebase Storage
 */
export async function uploadChatMedia(localUri: string, mediaType: "video" | "image"): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Sign in first.");

  const response = await fetch(localUri);
  const blob = await response.blob();
  const ext = (localUri.split(".").pop() || (mediaType === "video" ? "mp4" : "jpg")).split("?")[0];
  const filename = `${uid}_${Date.now()}.${ext}`;
  const path = `chat-media/${filename}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, {
    contentType: blob.type || (mediaType === "video" ? "video/mp4" : "image/jpeg"),
  });
  return getDownloadURL(storageRef);
}
