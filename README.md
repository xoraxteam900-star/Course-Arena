# Course Arena — Expo + Firebase

A rebuild of the original PHP/MySQL Course Arena app as an Expo (React
Native) app backed by Firebase (Auth, Firestore, Storage, Cloud Functions).
Paystack still handles payments — it's called from Cloud Functions, since
Firebase itself has no payment product.

## What's included

- **Auth**: email/password sign up + login (Firebase Auth), email verification
- **Learner flow**: browse/search courses by category, buy with wallet balance, save, like, comment, review, report
- **Wallet**: balance, deposit via Paystack, full transaction ledger
- **Instructor flow**: submit a course for review, track approval status
- **Admin flow**: approve/reject pending courses (in-app, gated by `role: "admin"`)
- **Logins Market backend**: `buyLoginProduct` Cloud Function (atomic, credentials never exposed to non-buyers) — UI screens aren't built yet, add them under `app/logins/` following the `course/[id].tsx` pattern
- Signup bonus and course-approval rewards are credited server-side, matching the original app's ledger types

Not yet built (original app had these too — flagged so nothing's assumed done): OTP-based email verification code flow (Firebase's built-in email link verification is wired in instead), report chat replies, ads carousel, public REST API/API keys, push notifications. All of these slot into the same collections already defined in `src/types.ts`.

## 1. Firebase project setup

You said you already have a Firebase project — good, use it:

1. **Enable products** in the Firebase Console for your project:
   - Authentication → Sign-in method → enable **Email/Password**
   - Firestore Database → create in production mode
   - Storage → get started
   - Upgrade to the **Blaze plan** (pay-as-you-go) — required for Cloud Functions to call the outside internet (Paystack)

2. **Register a Web app** (Project Settings → General → Your apps → Web `</>`). Copy the config values into `.env` (copy `.env.example` first).

3. **Install the Firebase CLI** and log in:
   ```
   npm install -g firebase-tools
   firebase login
   ```

4. Create `.firebaserc` in the project root:
   ```json
   { "projects": { "default": "YOUR_FIREBASE_PROJECT_ID" } }
   ```

5. **Set your Paystack secret key** as a Cloud Functions secret (never put this in the app):
   ```
   firebase functions:secrets:set PAYSTACK_SECRET_KEY
   ```
   Paste your Paystack **secret** key (starts `sk_`) when prompted.

6. **Deploy rules and functions**:
   ```
   cd functions && npm install && cd ..
   firebase deploy --only firestore:rules,storage:rules,functions
   ```

7. In the **Paystack dashboard**, set the webhook URL to:
   `https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/paystackWebhook`

8. **Seed categories + your first admin**:
   ```
   # Download a service account key (Project Settings → Service Accounts
   # → Generate new private key) and save it as scripts/serviceAccountKey.json
   node scripts/seed.js
   ```
   Register your own account in the app first, then set `ADMIN_EMAIL` in
   `scripts/seed.js` to your email and rerun to become an admin (or just
   run `firebase firestore` console and set `role: "admin"` on your user
   doc by hand — either works).

## 2. Run the app

```
npm install
cp .env.example .env   # then fill in your Firebase web config
npx expo start
```

Scan the QR code with **Expo Go** on your phone, or press `i`/`a` for a
simulator. This is the fastest way to test on a real device today.

## 3. Publish

**Fastest path — Expo Go / OTA updates** (good for testing with others immediately):
```
npx eas update --branch preview
```

**Real app store builds** (needed before Play Store/App Store submission):
```
npm install -g eas-cli
eas login
eas build:configure          # creates your EAS project, fills app.json's eas.projectId
eas build --platform android --profile preview   # installable APK for quick testing
eas build --platform android --profile production
eas build --platform ios --profile production    # needs an Apple Developer account ($99/yr)
eas submit --platform android
eas submit --platform ios
```

Android's internal testing track or a direct APK link is the quickest way to
get this in front of real testers; iOS requires TestFlight (still fast, just
needs the Apple Developer account first).

## Data model

See `src/types.ts` — it mirrors `database.sql` from the original app almost
1:1, mapped onto Firestore collections. Money-moving fields (`balance`,
course `accessLink`, login credentials) are never writable by the client —
only by Cloud Functions — enforced in `firestore.rules`.
