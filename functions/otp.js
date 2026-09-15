const functions = require("firebase-functions");
const { db, auth } = require("./admin");
const nodemailer = require("nodemailer");

const getTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

exports.requestPasswordResetOtp = functions.https.onCall(async (data, context) => {
  const email = data.email?.toLowerCase().trim();
  if (!email) {
    throw new functions.https.HttpsError("invalid-argument", "Email is required");
  }

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
  } catch (error) {
    return { success: true, message: "If an account exists, an OTP was sent." };
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  await db.collection("password_resets").doc(email).set({
    otp,
    expiresAt: Date.now() + 15 * 60 * 1000,
    uid: userRecord.uid,
  });

  const mailOptions = {
    from: `"Course Arena Support" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your Password Reset Code",
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; text-align: center;">
        <h2 style="color: #1769E0;">Course Arena</h2>
        <p>You requested a password reset. Use the code below to reset your password.</p>
        <div style="background-color: #F3F4F6; padding: 16px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 4px; margin: 24px 0;">
          ${otp}
        </div>
        <p style="color: #6B7280; font-size: 14px;">This code expires in 15 minutes.</p>
        <p style="color: #6B7280; font-size: 12px; margin-top: 32px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  };

  try {
    const transporter = getTransporter();
    await transporter.sendMail(mailOptions);
    return { success: true, message: "OTP sent successfully." };
  } catch (error) {
    console.error("Failed to send email:", error);
    throw new functions.https.HttpsError("internal", "Failed to send email. Ensure the configuration is correct.");
  }
});

exports.resetPasswordWithOtp = functions.https.onCall(async (data, context) => {
  const email = data.email?.toLowerCase().trim();
  const otp = data.otp?.trim();
  const newPassword = data.newPassword;

  if (!email || !otp || !newPassword) {
    throw new functions.https.HttpsError("invalid-argument", "Missing fields");
  }

  if (newPassword.length < 6) {
    throw new functions.https.HttpsError("invalid-argument", "Password must be at least 6 characters");
  }

  const docRef = db.collection("password_resets").doc(email);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw new functions.https.HttpsError("not-found", "Invalid or expired OTP");
  }

  const resetData = doc.data();

  if (resetData.otp !== otp) {
    throw new functions.https.HttpsError("invalid-argument", "Incorrect OTP");
  }

  if (Date.now() > resetData.expiresAt) {
    await docRef.delete();
    throw new functions.https.HttpsError("failed-precondition", "OTP has expired");
  }

  try {
    await auth.updateUser(resetData.uid, { password: newPassword });
    await docRef.delete();
    return { success: true, message: "Password updated successfully" };
  } catch (error) {
    console.error("Password update error:", error);
    throw new functions.https.HttpsError("internal", "Failed to update password");
  }
});
