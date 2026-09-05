// Run once after creating your Firebase project:
//   1. Download a service account key: Firebase Console -> Project Settings
//      -> Service Accounts -> Generate new private key -> save as
//      scripts/serviceAccountKey.json (already gitignored)
//   2. node scripts/seed.js
//
// Seeds the same starter categories as the original app, plus an empty
// site_settings doc and your first admin user (edit ADMIN_EMAIL below
// AFTER that user has registered once in the app).

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const CATEGORIES = [
  "Programming",
  "Web Development",
  "Graphics Design",
  "Business",
  "Marketing",
  "Cybersecurity",
  "AI",
  "Mobile Development",
];

// Set this to the email of a user who has already registered in the app,
// then run `node scripts/seed.js` again (or just the promote step) to
// make them an admin. Leave blank to skip.
const ADMIN_EMAIL = "";

async function main() {
  const batch = db.batch();
  for (const name of CATEGORIES) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const ref = db.collection("categories").doc(slug);
    batch.set(ref, { name, slug }, { merge: true });
  }
  batch.set(db.collection("site_settings").doc("main"), { logo: null }, { merge: true });
  await batch.commit();
  console.log(`Seeded ${CATEGORIES.length} categories.`);

  if (ADMIN_EMAIL) {
    const user = await admin.auth().getUserByEmail(ADMIN_EMAIL).catch(() => null);
    if (!user) {
      console.log(`No user found for ${ADMIN_EMAIL} — have them register first, then rerun.`);
      return;
    }
    await db.collection("users").doc(user.uid).update({ role: "admin" });
    console.log(`Promoted ${ADMIN_EMAIL} to admin.`);
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
