<?php
// verify.php
// Put this file in your InfinityFree htdocs folder

$reference = isset($_GET['reference']) ? $_GET['reference'] : '';
$uid = isset($_GET['uid']) ? $_GET['uid'] : '';

// ⚠️ CONFIGURE YOUR KEYS HERE
$paystack_secret = "sk_test_240362e138b1d2c9c217dd2107a3cb55ccd16c41";
$firebase_api_key = "AIzaSyDiZ5-3wYhOBH3y70uctTLhAW4EK_TPN60"; // Found in Firebase Project Settings > General
$firebase_project_id = "coursearena-8c761";
$admin_email = "dslash063@gmail.com"; // 👈 You must create this user in Firebase Auth!
$admin_password = "dslash063@gmail.com"; // 👈 The password for the admin account!

if (!$reference || !$uid) { die("Invalid request"); }

// 1. Verify Paystack Transaction
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "https://api.paystack.co/transaction/verify/" . rawurlencode($reference));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer " . $paystack_secret]);
$verify_res_raw = curl_exec($ch);
$verify_res = json_decode($verify_res_raw, true);

if (!isset($verify_res['data']['status']) || $verify_res['data']['status'] !== 'success') {
    die("Payment failed or not verified. Paystack response: " . $verify_res_raw . " | Reference: " . $reference);
}

$amountGhs = $verify_res['data']['amount'] / 100;

// 2. Login to Firebase as Admin to get an idToken
$auth_ch = curl_init();
curl_setopt($auth_ch, CURLOPT_URL, "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" . $firebase_api_key);
curl_setopt($auth_ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($auth_ch, CURLOPT_POST, 1);
curl_setopt($auth_ch, CURLOPT_POSTFIELDS, json_encode([
    "email" => $admin_email,
    "password" => $admin_password,
    "returnSecureToken" => true
]));
curl_setopt($auth_ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json"]);
$auth_res_raw = curl_exec($auth_ch);
$auth_res = json_decode($auth_res_raw, true);

if (!isset($auth_res['idToken'])) {
    die("Firebase Admin Login Failed. Response: " . $auth_res_raw);
}
$idToken = $auth_res['idToken'];

// 3. Get the user's current balance from Firestore
$fs_url = "https://firestore.googleapis.com/v1/projects/" . $firebase_project_id . "/databases/(default)/documents/users/" . rawurlencode($uid);
$get_ch = curl_init();
curl_setopt($get_ch, CURLOPT_URL, $fs_url);
curl_setopt($get_ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($get_ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer " . $idToken]);
$user_res = json_decode(curl_exec($get_ch), true);

$current_balance = 0;
if (isset($user_res['fields']['balance']['doubleValue'])) {
    $current_balance = floatval($user_res['fields']['balance']['doubleValue']);
} elseif (isset($user_res['fields']['balance']['integerValue'])) {
    $current_balance = floatval($user_res['fields']['balance']['integerValue']);
}

// Add the deposited amount to their current balance
$new_balance = $current_balance + $amountGhs;

// 4. Update the Balance in Firestore securely
$update_ch = curl_init();
curl_setopt($update_ch, CURLOPT_URL, $fs_url . "?updateMask.fieldPaths=balance");
curl_setopt($update_ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($update_ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
curl_setopt($update_ch, CURLOPT_POSTFIELDS, json_encode([
    "fields" => [
        "balance" => ["doubleValue" => $new_balance]
    ]
]));
curl_setopt($update_ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer " . $idToken,
    "Content-Type: application/json"
]);
curl_exec($update_ch);

// 5. Success! Redirect the browser back to the mobile app seamlessly
header("Location: coursearena://wallet");
exit;
?>
