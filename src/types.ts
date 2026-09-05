// Firestore data model. Collections map closely to the original MySQL tables.
// Timestamps are Firestore Timestamps; represented here as `any` for simplicity
// (cast to firebase/firestore Timestamp where needed).

export type UserRole = "user" | "instructor" | "admin";

export interface UserProfile {
  uid: string;
  fullName: string;
  username: string;
  email: string;
  role: UserRole; // "admin" set manually in Firestore or via custom claims
  balance: number; // wallet balance, kept in sync only via Cloud Functions
  signupBonusGiven: boolean;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  status: "active" | "suspended";
  createdAt: any;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export type ReviewStatus = "draft" | "pending_review" | "approved" | "rejected" | "suspended";

export interface Course {
  id: string;
  categoryId: string;
  creatorUserId: string | null; // null = admin-authored
  title: string;
  slug: string;
  description: string;
  image: string | null; // Storage download URL
  price: number;
  // NOTE: the real accessLink is NOT a field on this document — it lives
  // in a separate `course_access/{courseId}` doc that non-buyers can't
  // read (see firestore.rules). Buyers get it back from the
  // purchaseCourse / getMyAccessLink Cloud Functions.
  status: "published" | "hidden";
  reviewStatus: ReviewStatus;
  rejectionReason: string | null;
  approvedAt: any | null;
  approvalRewarded: boolean;
  likeCount: number;
  saveCount: number;
  viewCount: number;
  commentCount: number;
  avgRating: number;
  ratingCount: number;
  createdAt: any;
  updatedAt: any;
}

export interface Purchase {
  id: string; // `${userId}_${courseId}`
  userId: string;
  courseId: string;
  pricePaid: number;
  purchasedAt: any;
}

export type TransactionType =
  | "signup_bonus"
  | "deposit"
  | "purchase"
  | "admin_gift"
  | "course_approval_reward"
  | "refund";

export interface WalletTransaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number; // positive = credit, negative = debit
  description: string;
  status: "completed" | "pending" | "failed";
  createdAt: any;
}

export interface PaymentTransaction {
  id: string;
  userId: string;
  reference: string;
  amount: number;
  status: "pending" | "success" | "failed";
  createdAt: any;
  verifiedAt: any | null;
}

export interface AppNotification {
  id: string;
  targetUserId: string | null; // null = broadcast
  title: string;
  message: string;
  type: "system" | "report";
  reportId: string | null;
  expiresAt: any | null;
  createdAt: any;
}

export interface CourseReview {
  id: string; // `${userId}_${courseId}`
  courseId: string;
  userId: string;
  rating: number; // 1-5
  reviewText: string | null;
  createdAt: any;
  updatedAt: any;
}

export interface CourseComment {
  id: string;
  courseId: string;
  userId: string;
  message: string;
  likeCount: number;
  createdAt: any;
}

export interface CourseReport {
  id: string;
  userId: string;
  courseId: string;
  reason: string;
  status: "open" | "answered" | "closed";
  lastMessageAt: any;
  userSeenAt: any | null;
  createdAt: any;
}

export interface ReportMessage {
  id: string;
  reportId: string;
  senderType: "user" | "admin";
  message: string;
  createdAt: any;
}

export interface Ad {
  id: string;
  title: string;
  message: string;
  image: string | null;
  startDate: string;
  endDate: string;
  active: boolean;
  createdAt: any;
}

export interface LoginProduct {
  id: string;
  type: "credentials" | "telegram";
  service: string;
  title: string;
  description: string | null;
  image: string | null;
  price: number;
  status: "available" | "sold";
  buyerUserId: string | null;
  soldAt: any | null;
  createdAt: any;
  // login_username / login_password / phone_number / extra_info are
  // deliberately NOT read directly from the client. They're delivered
  // via a Cloud Function only after a verified purchase, same pattern
  // as course.accessLink.
}
