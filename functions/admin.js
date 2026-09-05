const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

const app = initializeApp();
const db = getFirestore(app);
const auth = getAuth(app);

module.exports = { app, db, auth };
