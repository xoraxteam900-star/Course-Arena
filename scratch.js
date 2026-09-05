const { initializeApp } = require("firebase/app");
const { getFirestore, collection, query, where, orderBy, getDocs } = require("firebase/firestore");

const app = initializeApp({
  projectId: "coursearena-8c761",
});
const db = getFirestore(app);

async function test() {
  try {
    await getDocs(query(collection(db, "notifications"), where("targetUserId", "==", null), orderBy("createdAt", "desc")));
    console.log("SUCCESS");
  } catch(e) {
    console.error(e.message);
  }
}
test();
